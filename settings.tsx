import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardHead, Page, Td, Th } from "@/components/cockpit";
import { BTN_GHOST, BTN_PRIMARY } from "@/components/ActionMenu";
import { FIELD, FieldLabel } from "@/components/CrmActionMenu";
import { runScoringNow } from "@/lib/scoring.functions";
import { PARAM_DEFS, PARAM_GROUPS, coerceParam, type RuntimeParams } from "@/lib/params";
import { getParams, restoreDefaultParams, updateParams } from "@/lib/params.functions";
import { getObservabilityData } from "@/lib/observability.functions";
import type { ObservabilityData, RunStage } from "@/lib/observability.server";
import { resetDemoData } from "@/lib/demo-reset.functions";
import { CONNECTORS, formatRelativeSync, type ConnectorHealth } from "@/lib/connectors";
import { getAccuracy } from "@/lib/accuracy.functions";
import { getCosEmail, setCosEmail } from "@/lib/handoff.functions";
import type { AccuracyData } from "@/lib/accuracy.server";
import { CachePanel, EntityQueuePanel } from "@/components/AdminPanels";
import { getEntityQueue } from "@/lib/entities.functions";
import type { EntityResolutionData } from "@/lib/entities.server";
import { getCache } from "@/lib/cache.functions";
import type { CacheStats } from "@/lib/cache.server";

export const Route = createFileRoute("/settings")({
  loader: async () => {
    const [accuracy, cosEmail, params, observability, entities, cache] = await Promise.all([
      getAccuracy(),
      getCosEmail(),
      getParams(),
      getObservabilityData(),
      getEntityQueue(),
      getCache(),
    ]);
    return { accuracy, cosEmail, params, observability, entities, cache };
  },
  head: () => ({
    meta: [
      { title: "Settings — Cockpit" },
      {
        name: "description",
        content: "Whether the rubric agrees with people, the scoring configuration, and connectors.",
      },
      { property: "og:title", content: "Settings — Cockpit" },
      {
        property: "og:description",
        content: "Whether the rubric agrees with people, the scoring configuration, and connectors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
  errorComponent: () => (
    <>
      <AppHeader title="Settings" />
      <Page>
        <Card>
          <div className="px-[18px] py-[34px] text-center text-[13px] text-muted-foreground">
            Settings could not be loaded. Try refreshing.
          </div>
        </Card>
      </Page>
    </>
  ),
  notFoundComponent: () => (
    <>
      <AppHeader title="Settings" />
      <Page>
        <Card>
          <div className="px-[18px] py-[34px] text-center text-[13px] text-muted-foreground">
            Nothing here.
          </div>
        </Card>
      </Page>
    </>
  ),
});

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-[18px] py-[15px]">
      <span className="eyebrow block">{label}</span>
      <span className="figure mt-1.5 block text-[27px] font-semibold leading-none tracking-[-0.02em]">
        {value}
      </span>
      <span className="mt-1.5 block text-[11.5px] text-muted-foreground">{note}</span>
    </div>
  );
}

/** Part one — does the rubric agree with the people who know the accounts? */
function RubricPanel({ data }: { data: AccuracyData }) {
  // A percentage is only honest once a human has actually disagreed at least once.
  const measurable = data.corrections > 0 && data.total_classifications > 0;
  const rate = measurable ? `${((data.accuracy_rate ?? 0) * 100).toFixed(1)}%` : "—";

  return (
    <Card>
      <CardHead title="Is the rubric right?" eyebrow="Measured from state history" />
      <div className="grid gap-4 px-[18px] py-[18px] sm:grid-cols-3">
        <Figure
          label="Classifications"
          value={String(data.total_classifications)}
          note="States the run has set"
        />
        <Figure
          label="Human corrections"
          value={String(data.corrections)}
          note={
            data.by_actor.length > 0
              ? data.by_actor.map((a) => `${a.actor} ${a.count}`).join(" · ")
              : "Nobody has overridden a state yet"
          }
        />
        <Figure
          label="Agreement rate"
          value={rate}
          note={
            measurable
              ? "Uncorrected classifications ÷ total"
              : "Not measurable until corrections exist"
          }
        />
      </div>

      {data.transitions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[13.5px]">
            <thead>
              <tr>
                <Th>The run said</Th>
                <Th>A human said</Th>
                <Th className="w-[80px] text-right">Times</Th>
              </tr>
            </thead>
            <tbody>
              {data.transitions.map((t) => (
                <tr key={`${t.predicted_state}-${t.corrected_state}`}>
                  <Td className="text-ink-2">{t.predicted_state}</Td>
                  <Td className="font-semibold">{t.corrected_state}</Td>
                  <Td className="figure text-right">{t.count}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="border-t border-border-soft px-[18px] py-[16px] text-[13px] text-muted-foreground">
          Correct a classification on any account and the disagreements start showing here.
        </p>
      )}
    </Card>
  );
}

/**
 * Part two — the rubric, editable. Values are stored as runtime parameters, so
 * the weights can be tuned without a redeploy. Nothing is re-scored on save:
 * the next run picks the new numbers up.
 */
function ParamPanel({ params }: { params: RuntimeParams }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(PARAM_DEFS.map((d) => [d.key, String(params[d.key] ?? d.default)])),
  );

  const dirty = PARAM_DEFS.filter((d) => Number(draft[d.key]) !== (params[d.key] ?? d.default));
  const offDefault = PARAM_DEFS.filter((d) => (params[d.key] ?? d.default) !== d.default);

  const save = useServerFn(updateParams);
  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          params: Object.fromEntries(
            dirty.map((d) => [d.key, coerceParam(d.key, Number(draft[d.key]))]),
          ),
        },
      }),
    onSuccess: async (next) => {
      setDraft(Object.fromEntries(PARAM_DEFS.map((d) => [d.key, String(next[d.key] ?? d.default)])));
      toast.success("Parameters saved", {
        description: "They apply on the next run — nothing is re-scored retrospectively.",
      });
      await router.invalidate();
    },
    onError: (e: Error) => toast.error("Could not save the parameters", { description: e.message }),
  });

  const restore = useServerFn(restoreDefaultParams);
  const restoreMutation = useMutation({
    mutationFn: () => restore(),
    onSuccess: async (next) => {
      setDraft(Object.fromEntries(PARAM_DEFS.map((d) => [d.key, String(next[d.key] ?? d.default)])));
      toast.success("Defaults restored", { description: "The shipped rubric is back." });
      await router.invalidate();
    },
    onError: (e: Error) => toast.error("Could not restore the defaults", { description: e.message }),
  });

  return (
    <Card>
      <CardHead
        title="Scoring configuration"
        eyebrow="Tunable at runtime · deterministic, no model involved"
        count={offDefault.length}
      />
      <p className="border-b border-border-soft px-[18px] py-[13px] text-[13px] text-muted-foreground">
        Changes apply from the next run. History is never re-scored, so a past board always shows
        the numbers it was built with.
      </p>

      {PARAM_GROUPS.map((group) => (
        <div key={group}>
          <div className="border-b border-border-soft bg-border-soft/40 px-[18px] py-[8px]">
            <span className="eyebrow">{group}</span>
          </div>
          <div className="grid gap-x-6 gap-y-3.5 px-[18px] py-[16px] sm:grid-cols-2">
            {PARAM_DEFS.filter((d) => d.group === group).map((d) => {
              const changed = Number(draft[d.key]) !== (params[d.key] ?? d.default);
              return (
                <div key={d.key} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`param-${d.key}`}
                      className="block text-[13px] font-medium text-foreground"
                    >
                      {d.label}
                    </label>
                    {d.note ? (
                      <span className="block text-[11.5px] text-muted-foreground">{d.note}</span>
                    ) : null}
                  </div>
                  <input
                    id={`param-${d.key}`}
                    type="number"
                    min={d.min}
                    max={d.max}
                    step={d.step}
                    value={draft[d.key] ?? ""}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [d.key]: e.target.value }))}
                    className={`figure w-[92px] shrink-0 rounded-[5px] border bg-card px-2.5 py-[6px] text-right text-[13px] outline-none focus:border-brand ${
                      changed ? "border-brand" : "border-border"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2.5 border-t border-border-soft px-[18px] py-[15px]">
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={dirty.length === 0 || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending
            ? "Saving…"
            : dirty.length
              ? `Save ${dirty.length} change${dirty.length === 1 ? "" : "s"}`
              : "Save changes"}
        </button>
        <button
          type="button"
          className={BTN_GHOST}
          disabled={offDefault.length === 0 || restoreMutation.isPending}
          onClick={() => restoreMutation.mutate()}
        >
          Restore the defaults
        </button>
        <span className="text-[12px] text-muted-foreground">
          {offDefault.length
            ? `${offDefault.length} parameter${offDefault.length === 1 ? "" : "s"} tuned away from the shipped rubric`
            : "Every parameter is at its shipped default"}
        </span>
      </div>
    </Card>
  );
}

function ms(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${value}ms`;
}

/** Part three — what the last run actually did, stage by stage. */
function ObservabilityPanel({ data }: { data: ObservabilityData }) {
  return (
    <Card>
      <CardHead
        title="Run observability"
        eyebrow={
          data.last_run
            ? `Last run ${data.last_run.run_date} · ${ms(data.last_run.total_ms)} across ${data.last_run.stages.length} stages`
            : "No run logged yet"
        }
        count={data.incidents.length}
      />

      {data.last_run ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
            <thead>
              <tr>
                <Th>Stage</Th>
                <Th className="w-[90px]">Status</Th>
                <Th className="w-[90px] text-right">Time</Th>
                <Th className="w-[90px] text-right">Records</Th>
                <Th className="w-[110px] text-right">Confidence</Th>
                <Th>Detail</Th>
              </tr>
            </thead>
            <tbody>
              {data.last_run.stages.map((s: RunStage) => (
                <tr key={s.stage}>
                  <Td className="font-semibold">{s.stage}</Td>
                  <Td>
                    <span
                      className={`figure inline-flex rounded-full px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.06em] ${
                        s.status === "ok"
                          ? "bg-state-pipeline text-state-pipeline-foreground"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {s.status === "ok" ? "Ok" : "Failed"}
                    </span>
                  </Td>
                  <Td className="figure text-right">{ms(s.duration_ms)}</Td>
                  <Td className="figure text-right">{s.records || "—"}</Td>
                  <Td className="figure text-right">
                    {s.confidence === null ? "—" : s.confidence.toFixed(2)}
                  </Td>
                  <Td className="text-[12.5px] text-muted-foreground">{s.detail ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="border-b border-border-soft px-[18px] py-[16px] text-[13px] text-muted-foreground">
          Nothing logged · run scoring below and every stage appears here with its timing.
        </p>
      )}

      <div className="grid gap-4 border-t border-border-soft px-[18px] py-[18px] sm:grid-cols-3">
        <Figure
          label="Extraction confidence"
          value={`${(data.extraction.confidence * 100).toFixed(0)}%`}
          note={`${data.extraction.unrated} of ${data.extraction.touchpoints} touchpoints carry no rating`}
        />
        <Figure
          label="Incomplete accounts"
          value={String(data.extraction.missing_icp)}
          note="Missing ICP fit or subscores"
        />
        <Figure
          label="Unattributed touchpoints"
          value={String(data.extraction.missing_contact)}
          note="No contact resolved on the record"
        />
      </div>

      {data.incidents.length ? (
        <div className="border-t border-border-soft px-[18px] py-[15px]">
          <span className="eyebrow block">Source problems</span>
          <ul className="mt-2 space-y-1.5">
            {data.incidents.map((i) => (
              <li key={i.source} className="text-[13px]">
                <span className="font-semibold">{i.source}</span>
                <span className="figure ml-2 text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                  {i.health}
                </span>
                <span className="ml-2 text-muted-foreground">{i.note}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.history.length > 1 ? (
        <div className="border-t border-border-soft px-[18px] py-[15px]">
          <span className="eyebrow block">Recent runs</span>
          <ul className="mt-2 space-y-1">
            {data.history.map((h) => (
              <li key={h.run_date} className="figure text-[12px] text-ink-2">
                {h.run_date} · {ms(h.total_ms)} · {h.stages} stages ·{" "}
                {h.failed ? `${h.failed} failed` : "clean"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

const HEALTH_STYLES: Record<ConnectorHealth, string> = {
  Healthy: "bg-state-pipeline text-state-pipeline-foreground",
  Degraded: "bg-state-keep text-state-keep-foreground",
  Stale: "bg-state-lost text-state-lost-foreground",
};

/** Part three — the six sources the production system ingests from. Values are simulated. */
function ConnectorPanel() {
  return (
    <Card>
      <CardHead title="Connectors" eyebrow="Simulated sync state · prototype only" />
      <p className="border-b border-border-soft px-[18px] py-[13px] text-[13px] text-muted-foreground">
        This prototype runs on seeded data. Nothing below is a live connection — the table documents
        the six sources the production system reads from, including one deliberately stale source so
        you can see how a broken feed surfaces.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-[13.5px]">
          <thead>
            <tr>
              <Th>Source</Th>
              <Th className="w-[190px]">Method</Th>
              <Th className="w-[130px]">Cadence</Th>
              <Th className="w-[130px]">Last sync</Th>
              <Th className="w-[100px] text-right">Records</Th>
              <Th className="w-[110px]">Health</Th>
            </tr>
          </thead>
          <tbody>
            {CONNECTORS.map((c) => (
              <tr key={c.name}>
                <Td>
                  <span className="text-[14px] font-semibold tracking-[-0.005em]">{c.name}</span>
                  <span className="mt-[1px] block text-[11.5px] text-muted-foreground">
                    {c.note}
                  </span>
                </Td>
                <Td className="text-[13px] text-ink-2">{c.method}</Td>
                <Td className="text-[13px] text-ink-2">{c.cadence}</Td>
                <Td className="figure whitespace-nowrap text-[12px] text-muted-foreground">
                  {formatRelativeSync(c.lastSyncMinutesAgo)}
                </Td>
                <Td className="figure text-right">{c.recordsLastRun}</Td>
                <Td>
                  <span
                    className={`figure inline-flex rounded-full px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.06em] ${HEALTH_STYLES[c.health]}`}
                  >
                    {c.health}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function OperationsPanel({ cosEmail }: { cosEmail: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(cosEmail);

  const saveEmail = useServerFn(setCosEmail);
  const emailMutation = useMutation({
    mutationFn: () => saveEmail({ data: { email } }),
    onSuccess: async (res) => {
      toast.success("Chief of staff address saved", { description: res.email });
      await router.invalidate();
    },
    onError: (e: Error) => toast.error("Could not save the address", { description: e.message }),
  });

  const run = useServerFn(runScoringNow);
  const runMutation = useMutation({
    mutationFn: () => run(),
    onSuccess: async (result) => {
      toast.success(`Run complete for ${result.run_date}`, {
        description: `${result.companies_scored} scored · ${result.ranked} ranked · ${result.excluded} excluded`,
      });
      await router.invalidate();
    },
    onError: (e: Error) => toast.error("The run failed", { description: e.message }),
  });

  const reset = useServerFn(resetDemoData);
  const resetMutation = useMutation({
    mutationFn: () => reset(),
    onSuccess: async (result) => {
      toast.success("Demo data reset", {
        description: `${result.counts["companies"] ?? 0} accounts · ${result.counts["touchpoints"] ?? 0} touchpoints · rescored (${result.scoring.ranked} ranked)`,
      });
      await queryClient.invalidateQueries();
      await router.invalidate();
    },
    onError: (e: Error) => toast.error("The reset failed", { description: e.message }),
  });

  return (
    <Card>
      <CardHead title="Operations" eyebrow="Run the engine, set the handoff recipient, reset the demo" />
      <div className="grid gap-4 px-[18px] py-[18px] sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="cos-email">Chief of staff address</FieldLabel>
          <div className="flex gap-2.5">
            <input
              id="cos-email"
              type="email"
              className={FIELD}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="button"
              className={BTN_GHOST}
              disabled={emailMutation.isPending || email.trim() === cosEmail}
              onClick={() => emailMutation.mutate()}
            >
              Save it
            </button>
          </div>
        </div>
        <div className="flex items-end gap-2.5">
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={runMutation.isPending}
            onClick={() => runMutation.mutate()}
          >
            {runMutation.isPending ? "Running…" : "Run scoring now"}
          </button>
          <button
            type="button"
            className={BTN_GHOST}
            disabled={resetMutation.isPending}
            onClick={() => resetMutation.mutate()}
          >
            {resetMutation.isPending ? "Resetting…" : "Reset demo data"}
          </button>
        </div>
      </div>
    </Card>
  );
}

function SettingsPage() {
  const { accuracy, cosEmail, params, observability, entities, cache } =
    Route.useLoaderData() as {
      accuracy: AccuracyData;
      cosEmail: string;
      params: RuntimeParams;
      observability: ObservabilityData;
      entities: EntityResolutionData;
      cache: CacheStats;
    };

  return (
    <>
      <AppHeader title="Settings" />
      <Page>
        <RubricPanel data={accuracy} />
        <ParamPanel params={params} />
        <ObservabilityPanel data={observability} />
        <EntityQueuePanel data={entities} actor="CEO" />
        <CachePanel data={cache} />
        <ConnectorPanel />
        <OperationsPanel cosEmail={cosEmail} />
      </Page>
    </>
  );
}
