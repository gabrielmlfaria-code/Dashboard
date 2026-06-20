import { HttpClient } from "../../core/httpClient.js";

function buildQS(params) {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value != null && value !== "") sp.append(key, String(value));
  });
  const query = sp.toString();
  return query ? `?${query}` : "";
}

export const RemoteApiAdapter = {
  async get(route, params) {
    return HttpClient.request(`${route}${buildQS(params)}`);
  },

  async post(route, body) {
    return HttpClient.post(route, body);
  },

  async put(route, body) {
    return HttpClient.put(route, body);
  },
};
