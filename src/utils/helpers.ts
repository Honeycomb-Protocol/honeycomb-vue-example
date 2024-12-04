import { EdgeClient } from "@honeycomb-protocol/edge-client/client/types";
import * as web3 from "@solana/web3.js";
import base58 from "bs58";

export async function generateAuthToken(
  edgeClient: EdgeClient<true>,
  publicKey: web3.PublicKey,
  wallet: any,
  usingLedger?: boolean
) {
  console.log("wallet:", wallet);
  try {
    const res = await edgeClient.authRequest({
      wallet: publicKey.toString(),
      useTx: usingLedger,
      useRpc: usingLedger ? process.env.NEXT_PUBLIC_HELIUS_RPC_URL : undefined,
    });
    let signature: string;

    if (res.authRequest.tx) {
      const sig = await wallet.adapter.signTransaction(
        web3.Transaction.from(base58.decode(res.authRequest.tx))
      );
      signature = base58.encode(
        sig.signatures.find((s: web3.SignaturePubkeyPair) =>
          s.publicKey.equals(publicKey)
        )?.signature
      );
    } else {
      const message = new TextEncoder().encode(res.authRequest.message);
      const sig = await wallet.adapter.signMessage(message);
      signature = base58.encode(sig);
    }

    const {
      authConfirm: { accessToken: token },
    } = await edgeClient.authConfirm({
      signature: signature,
      wallet: publicKey.toString(),
    });

    return token;
  } catch (e) {
    console.error("Failed to generate auth token: ", e);
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}
