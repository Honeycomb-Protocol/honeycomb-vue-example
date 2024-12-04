// eslint-disable
import createEdgeClient from "@honeycomb-protocol/edge-client";

export const DAS_RPC =
  process.env.RPC_ENDPOINT || "https://rpc.test.honeycombprotocol.com";
export const API_URL =
  process.env.API_URL || "https://edge.test.honeycombprotocol.com";
export const HPL_PROJECT_PUBLIC_KEY =
  "Gj6UaodRwTkQGD8pPjxMPm3nNSbQbobjcq1nxZv2aekQ";
export const pfp =
  "https://www.arweave.net/1MDsAxGaezXbo80mZqEOZrub-nvVDxXccRNo-gNib4U?ext=png";
export const edgeClient = createEdgeClient(API_URL, true);
