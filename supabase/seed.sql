-- Local development seed. Opportunities are illustrative and flagged is_sample (shown as "Sample").
insert into public.opportunities (title, description, category, sectors, countries, min_months_records, min_proof_level,
                                  budget_min_minor, budget_max_minor, currency, deadline, contact, is_sample)
values
  ('Weekly rice and beans supply for a school kitchen',
   'A private school in Lagos needs a reliable weekly supplier of rice, beans and palm oil for the new term. Consistent delivery matters more than lowest price.',
   'supply_contract', array['Retail / provisions', 'Wholesale', 'Food & catering'], array['NG'], 3, 'document_backed',
   50000000, 120000000, 'NGN', current_date + 45, 'procurement@example.org', true),
  ('Catering for monthly community health days',
   'An NGO is looking for a caterer to provide lunch for 80 to 120 people once a month in Accra.',
   'buyer_request', array['Food & catering'], array['GH'], 2, 'self_reported',
   300000, 600000, 'GHS', current_date + 30, 'events@example.org', true),
  ('Working-capital program for women-led retailers',
   'A lender-backed program offering stock financing and coaching to retailers with at least six months of records. Applicants share a Foundry Passport.',
   'financing', array['Retail / provisions', 'Fashion & tailoring', 'Salon & beauty'], array['NG', 'GH', 'KE'], 6, 'document_backed',
   null, null, null, current_date + 60, 'apply@example.org', true),
  ('Free bookkeeping and pricing workshop',
   'A two-evening workshop on pricing, stock control and cash flow for small business owners.',
   'training', array[]::text[], array[]::text[], 0, 'self_reported',
   null, null, null, current_date + 21, 'learn@example.org', true);

-- B41: dual approval is ON by default (production). Local development runs single-admin.
update public.platform_settings set value = 'false' where key = 'dual_approval';
