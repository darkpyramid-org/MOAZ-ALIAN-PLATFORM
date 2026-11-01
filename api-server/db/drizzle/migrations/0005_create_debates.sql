CREATE TABLE public.debates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name text NOT NULL,
  guest_background text,
  topic text NOT NULL,
  reply_summary text,
  outcome text NOT NULL DEFAULT 'open',
  debate_date date,
  video_url text,
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debates TO authenticated;
GRANT ALL ON public.debates TO service_role;
ALTER TABLE public.debates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage debates" ON public.debates FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER debates_touch BEFORE UPDATE ON public.debates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
