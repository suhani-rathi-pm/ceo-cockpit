"""AI-drafted outreach messages for top-scoring leads.

Deterministic scoring/classification (scoring.py, classify.py) decides WHO
gets a draft. This module only decides WHAT to say, and only for the
company_names it's handed -- it doesn't re-derive scope itself.
"""

import pandas as pd
from google import genai
from google.genai import types

MODEL = "gemini-flash-latest"

SYSTEM_PROMPT = """You are ghostwriting a short outreach email on behalf of a busy CEO \
reaching out personally to a business contact about an active deal.

Voice rules:
- Direct. No pleasantries -- never "I hope this finds you well", "hope you're doing great", \
or similar throat-clearing.
- No softening hedges. Banned phrases: "I wanted to make sure", "I'd be glad to", "I'd like to", \
"I was hoping", "just following up", "just wanted to check in", "no rush", "when you get a chance". \
State things directly instead: not "I'd like to get on a call" but "let's get on a call" or "call me".
- No fluff, no over-explaining, no corporate boilerplate.
- Short: 3-5 sentences in the body, max.
- Reads like someone who typed it themselves in two minutes between meetings, not a template.
  Plain statements and direct asks, not requests wrapped in politeness.
- Reference the specific context given -- don't invent facts not in the context.
- The "CRM notes" given are a sales rep's subjective impressions, not confirmed facts --
  you can use them to calibrate tone (e.g. how warm/skeptical to be) but don't quote them
  back to the contact as if the contact said them.

Output only the email: one line starting with "Subject:", a blank line, then the body. \
Nothing else -- no preamble, no explanation."""


def build_lead_context(company_name: str, scored_touchpoints: pd.DataFrame) -> dict:
    company_touchpoints = scored_touchpoints[
        scored_touchpoints["company_name"] == company_name
    ].sort_values("touchpoint_date", ascending=False)

    latest = company_touchpoints.iloc[0]
    comments_history = [
        c for c in company_touchpoints["misc_comments"].tolist() if pd.notna(c)
    ]

    return {
        "company_name": company_name,
        "industry": latest["industry"],
        "contact_name": latest["contact_name"],
        "contact_title": latest["contact_title"],
        "last_touchpoint_type": latest["touchpoint_type"],
        "last_touchpoint_date": latest["touchpoint_date"].strftime("%Y-%m-%d"),
        "last_touchpoint_notes": latest["granola_notes"],
        "next_step": latest["next_step"],
        "next_step_date": latest["next_step_date"],
        "est_opportunity_size": latest["est_opportunity_size"],
        "crm_notes_history": comments_history,
    }


def _format_user_message(context: dict) -> str:
    lines = [
        f"Company: {context['company_name']} ({context['industry']})",
        f"Contact: {context['contact_name']}, {context['contact_title']}",
        f"Opportunity size band: {context['est_opportunity_size']}",
        f"Most recent touchpoint: {context['last_touchpoint_type']} on {context['last_touchpoint_date']}",
        f"Notes from that touchpoint: {context['last_touchpoint_notes']}",
        f"Agreed next step: {context['next_step']}"
        + (f" (by {context['next_step_date']})" if context["next_step_date"] else ""),
    ]
    if context["crm_notes_history"]:
        lines.append("CRM's subjective notes on this relationship over time:")
        lines.extend(f"  - {c}" for c in context["crm_notes_history"])

    lines.append(
        "\nDraft a short outreach email from the CEO to this contact that moves this deal forward."
    )
    return "\n".join(lines)


def draft_outreach(client: genai.Client, context: dict, model: str = MODEL) -> str:
    response = client.models.generate_content(
        model=model,
        contents=_format_user_message(context),
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            # this model can't fully disable its internal reasoning step,
            # and that reasoning counts against max_output_tokens -- budget
            # generously so the actual draft doesn't get truncated
            max_output_tokens=2048,
            thinking_config=types.ThinkingConfig(thinking_budget=256),
        ),
    )
    return response.text.strip()


def draft_all(
    client: genai.Client, company_names: list[str], scored_touchpoints: pd.DataFrame
) -> dict[str, str]:
    drafts = {}
    for company_name in company_names:
        context = build_lead_context(company_name, scored_touchpoints)
        drafts[company_name] = draft_outreach(client, context)
    return drafts
