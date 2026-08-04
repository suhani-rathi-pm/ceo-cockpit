UPDATE public.actions a
SET subject = replace(a.subject, '{company}', c.name),
    body = replace(a.body, '{company}', c.name)
FROM public.companies c
WHERE c.id = a.company_id
  AND a.type = 'email_handoff'
  AND (a.subject LIKE '%{company}%' OR a.body LIKE '%{company}%');