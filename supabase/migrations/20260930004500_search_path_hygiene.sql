-- B51 hosted advisor (0011 function_search_path_mutable): pin search_path on the four remaining
-- immutable SQL helpers. Their bodies are already schema-qualified, so behaviour is unchanged.
alter function private.provenance_rank(public.provenance) set search_path = '';
alter function private.benchmark_min_n() set search_path = '';
alter function private.confidence_for(integer, numeric) set search_path = '';
alter function private.normalize_contact(text) set search_path = '';
