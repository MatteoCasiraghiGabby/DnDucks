async function processMapImage(mapStore, mapId) {
  const map = await mapStore.getMap(mapId);
  if (!map) {
    throw Object.assign(new Error("Map not found."), { statusCode: 404, code: "MAP_NOT_FOUND" });
  }

  await mapStore.updateMapStatus(mapId, "processing");

  try {
    const updated = await mapStore.updateMapStatus(mapId, "ready");
    return {
      map: updated,
      cities: [],
      detectionImplemented: false,
      message: "Automatic city detection is not implemented yet. Add pins manually on the map viewer.",
    };
  } catch (error) {
    await mapStore.updateMapStatus(mapId, "failed").catch(() => {});
    throw error;
  }
}

module.exports = {
  processMapImage,
};
