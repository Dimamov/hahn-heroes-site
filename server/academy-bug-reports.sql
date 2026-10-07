alter table public.academy_reports add column message text check(char_length(message)<=1000);
