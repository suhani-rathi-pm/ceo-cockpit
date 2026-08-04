DELETE FROM public.news_dismissals;
UPDATE public.news_items SET dismissed = false WHERE dismissed = true;