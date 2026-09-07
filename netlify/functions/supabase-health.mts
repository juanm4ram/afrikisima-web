export default async function () {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.log("Supabase no está configurado; control omitido.");
    return;
  }

  const response = await fetch(url + "/rest/v1/rpc/catalog_health", {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  if (!response.ok) {
    throw new Error("Supabase health check falló con HTTP " + response.status);
  }

  const publishedVariants = await response.json();
  console.log("Supabase activo. Variantes publicadas:", publishedVariants);
}
