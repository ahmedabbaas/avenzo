do $rls_initplan$
declare
  policy_row record;
  using_clause text;
  check_clause text;
begin
  for policy_row in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%'
      )
  loop
    using_clause := case
      when policy_row.qual is null then ''
      else ' USING (' ||
        replace(policy_row.qual, 'auth.uid()', '(select auth.uid())') ||
        ')'
    end;

    check_clause := case
      when policy_row.with_check is null then ''
      else ' WITH CHECK (' ||
        replace(policy_row.with_check, 'auth.uid()', '(select auth.uid())') ||
        ')'
    end;

    execute format(
      'ALTER POLICY %I ON %I.%I%s%s',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename,
      using_clause,
      check_clause
    );
  end loop;
end
$rls_initplan$;
