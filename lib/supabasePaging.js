const HISTORICAL_COLUMNS =
  "unique_id, level_in_percents, saved_time, temp, humidity, h2s, nh3, smoke";

export async function fetchAllHistoricalForDevice(
  supabase,
  uniqueId,
  pageSize = 1000
) {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const page = await supabase
      .from("historical")
      .select(HISTORICAL_COLUMNS)
      .eq("unique_id", uniqueId)
      .order("saved_time", { ascending: true })
      .range(from, to);

    if (page.error) {
      return { data: rows, error: page.error };
    }

    const batch = page.data ?? [];
    rows.push(...batch);

    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return { data: rows, error: null };
}
