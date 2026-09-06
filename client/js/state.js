/**
 * 플레이어 키 관리하는 파일
 */

const KEY = "pvp-identity";
export const saveIdentity = (data) => localStorage.setItem(KEY, JSON.stringify(data));
export const loadIdentity = () => JSON.parse(localStorage.getItem(KEY) || "null");
export const clearIdentity = () => localStorage.removeItem(KEY);