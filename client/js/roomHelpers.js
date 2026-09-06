// client/js/roomHelpers.js

export function getMyCharacters(roomState, myPlayerId) {
  return (roomState?.characters || []).filter((c) => c.ownerId === myPlayerId);
}

export function getMyPlayerName(roomState, myPlayerId) {
  return roomState?.players?.find((p) => p.id === myPlayerId)?.name || "";
}

export function getPlayerById(roomState, playerId) {
  return roomState?.players?.find((p) => p.id === playerId) || null;
}