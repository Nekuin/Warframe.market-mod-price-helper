const base_url = "https://api.warframe.market/v2";
const headers = {
  "Language": "en"
}

const getItems = async () => {
  const response = await fetch(`${base_url}/items`,
    {
      method: "GET",
      headers,
    }
  )

  const data = await response.json();
  return data.data;
}

export const marketMods = async () => {
  const items = await getItems();

  return items.reduce((modItems, item) => {
    if (item.tags.includes("mod") && !item.tags.includes("pvp") && !item.gameRef.includes("PvPAugment")) {
      modItems.push({
        slug: item.slug,
        name: item.i18n.en.name,
      });
    }
    return modItems;
  }, [])
}

export const topSellOrder = async (itemSlug) => {
  const response = await fetch(
    `${base_url}/orders/item/${itemSlug}/top`,
    {
      method: "GET",
      headers,
    }
  );

  if (response.status == 429) {
    return {
      timeout: true
    }
  }
  const data = await response.json();
  const sellOrders = data.data.sell;
  const platPrices = sellOrders.map(order => order.platinum);

  const exists = platPrices[0] || false;

  return {
    lowest: exists ? platPrices[0] : 0,
    average: exists ? platPrices.reduce((a, b) => a + b, 0) / platPrices.length : 0,
  }
}


