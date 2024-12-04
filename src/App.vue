<template>
  <div id="app">
    <WalletMultiButton />
    <div v-if="loading" class="container loading">
      <div class="spinner"></div>
    </div>
    <div v-else-if="profile" class="container">
      <div class="image-container">
        <h2>Your Profile</h2>
        <div class="image">
          <img :src="profile.info.pfp || ''" alt="Profile Image" />
          <p class="info"><strong>Name:</strong> {{ profile.info.name }}</p>
          <p class="info"><strong>Bio:</strong> {{ profile.info.bio }}</p>
        </div>
      </div>
    </div>
    <div v-else-if="publicKey" class="container">
      <div class="image-container">
        <h2>Your Profile</h2>
        <div class="image">
          <img
            src="https://www.arweave.net/1MDsAxGaezXbo80mZqEOZrub-nvVDxXccRNo-gNib4U?ext=png"
            alt="Profile Image"
          />
        </div>
      </div>
      <template class="profile-form__fields">
        <div class="form-field">
          <input
            type="text"
            id="display-name"
            v-model="name"
            placeholder="Enter your display name"
          />
        </div>

        <div class="form-field">
          <textarea
            id="bio"
            v-model="bio"
            placeholder="Tell us about yourself"
          ></textarea>
        </div>

        <div class="action-buttons">
          <button
            :disabled="false"
            type="submit"
            class="btn-primary"
            @click="handleSignUp"
          >
            Sign Up
          </button>
          <button
            type="button"
            :disabled="true"
            class="btn-secondary"
            style="cursor: default"
          >
            Log In
          </button>
        </div>
      </template>
    </div>
    <template v-else>
      <img :src="GifAnimation" alt="logo" class="logo" />
      <h2 class="connect-wallet-title">
        Connect Your Wallet to start using
        <span style="color: #9ea7f1">Honeycomb</span>
      </h2>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import { WalletMultiButton } from "solana-wallets-vue";
import { useWallet } from "solana-wallets-vue";
import * as web3 from "@solana/web3.js";
import base58 from "bs58";
import { generateAuthToken } from "@/utils/helpers";
import "vue-toast-notification/dist/theme-sugar.css";
import { edgeClient, HPL_PROJECT_PUBLIC_KEY, pfp } from "./hpl";
import {
  FindUsersQuery,
  Profile,
  Transaction,
} from "@honeycomb-protocol/edge-client";
// @ts-expect-error - no types available
import GifAnimation from "@/assets/animation.gif";

export default defineComponent({
  name: "App",
  components: {
    WalletMultiButton,
  },

  data() {
    const wallet = useWallet();
    return {
      name: "",
      bio: "",
      pfp,
      GifAnimation,
      wallet,
      user: null as FindUsersQuery["user"][0] | null,
      loading: "",
    };
  },

  computed: {
    publicKey(): string | null {
      return this.wallet.publicKey?.toString() || null;
    },
    signTransaction() {
      return this.wallet.signTransaction;
    },
    profile(): Profile | null {
      return this.user?.profiles?.[0] || null;
    },
  },

  methods: {
    handleError(message: string) {
      this.$toast.error(message);
    },

    async handleSignUp() {
      if (!this.name) return this.handleError("Name is required");
      if (!this.publicKey) return this.handleError("Wallet not connected");
      if (!this.bio) return this.handleError("Bio is required");
      if (!this.signTransaction)
        return this.handleError("Error signing transaction");
      if (!this.wallet.wallet || !this.wallet.publicKey)
        return this.handleError("Error Processing Wallet");

      try {
        const user = await this.fetchUserByWallet();
        const isUserCreated = !!user?.address;
        const profile = user?.profiles?.[0] || null;

        if (isUserCreated && !profile) {
          const authToken = await generateAuthToken(
            edgeClient,
            this.wallet.publicKey,
            this.wallet.wallet
          );
          await this.createProfile(authToken);
        } else if (!isUserCreated) {
          await this.createUserWithProfile();
        }

        this.loading = this.publicKey;
        this.user = await this.fetchUserByWallet();
        this.loading = "";
      } catch (error) {
        console.error("Profile creation failed:", error);
        this.handleError((error as Error).message);
      }
    },

    async fetchUserByWallet() {
      if (!this.publicKey) return null;
      const userResponse = await edgeClient.findUsers({
        wallets: [this.publicKey],
        includeProjectProfiles: [HPL_PROJECT_PUBLIC_KEY],
      });
      return userResponse?.user[0] || null;
    },

    async createProfile(authToken: string) {
      if (!this.publicKey) return this.handleError("Wallet not connected");

      const transactionData = await edgeClient.createNewProfileTransaction(
        {
          project: HPL_PROJECT_PUBLIC_KEY,
          payer: this.publicKey,
          identity: this.publicKey,
          info: { bio: this.bio, name: this.name, pfp },
        },
        {
          fetchOptions: {
            headers: { authorization: `Bearer ${authToken}` },
          },
        }
      );

      await this.submitTransaction(transactionData.createNewProfileTransaction);
    },

    async createUserWithProfile() {
      if (!this.publicKey) return this.handleError("Wallet not connected");

      const transactionData =
        await edgeClient.createNewUserWithProfileTransaction({
          wallet: this.publicKey,
          userInfo: { pfp, bio: this.bio, name: this.name },
          project: HPL_PROJECT_PUBLIC_KEY.toString(),
          payer: this.publicKey,
        });

      await this.submitTransaction(
        transactionData.createNewUserWithProfileTransaction
      );
    },

    async submitTransaction(transaction: Transaction) {
      const signedTx = await this.wallet.signTransaction?.(
        web3.VersionedTransaction.deserialize(
          base58.decode(transaction.transaction)
        )
      );

      if (!signedTx) return this.handleError("Transaction signing failed");

      try {
        const txnResult = await edgeClient.sendBulkTransactions({
          txs: [base58.encode(signedTx.serialize())],
          blockhash: transaction.blockhash,
          lastValidBlockHeight: transaction.lastValidBlockHeight,
          options: { commitment: "confirmed", skipPreflight: true },
        });

        this.$toast.success("Profile created successfully!");
        console.log("Transaction result:", txnResult);
      } catch (error) {
        console.error("Transaction error:", error);
        this.handleError(
          "An unexpected error occurred while sending the transaction"
        );
      }
    },
  },
  watch: {
    publicKey: {
      immediate: true,
      async handler(publicKey) {
        if (publicKey) {
          if (this.loading === publicKey) return;
          this.loading = publicKey;
          this.user = await this.fetchUserByWallet();
          this.loading = "";
        } else {
          this.user = null;
        }
      },
    },
  },
});
</script>

<style lang="scss">
body {
  margin: 0;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica,
    Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
  color: #fff;
  background-color: #0b0f19;
  min-height: 100vh; /* Full viewport height */
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  display: grid;
  place-items: center;
  place-content: center;
  min-height: 100vh;

  p {
    margin: 10px 0;
    font-size: 1.1em;
  }
}

.connect-wallet-title {
  font-weight: 700;
  font-size: calc(1rem + 2vw);
  line-height: 1.375;
  text-align: center;
  margin-bottom: 40px;
  color: #fff;
  width: 50%;
}

.profile-form__fields {
  display: flex;
  flex-direction: column;
}

.info {
  width: 250px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.container {
  border-radius: 10px;
  height: 100%;
  padding: 20px;
  background: rgba(51, 51, 51, 0.4);
  box-shadow: rgba(0, 0, 0, 0.5) 0px 4px 16px 0px;
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  gap: 20px;
}

.logo {
  margin-bottom: -50px;
  margin-top: 20px;
  max-width: 202px;
}

.loading {
  width: 250px;
  min-height: 451.3px;
}

.container .image-container h2 {
  font-weight: 700;
  font-size: calc(1rem + 1vw);
  line-height: 1.375;
  text-align: center;
  color: #fff;
}

.container .image-container img {
  height: 200px;
  width: 200px;
  border-radius: 10px;
}

.container input,
.container textarea {
  letter-spacing: inherit;
  color: #fff;
  padding: 4px 0 5px;
  border: 0;
  background: none;
  height: 1.4375em;
  margin: 0;
  -webkit-tap-highlight-color: transparent;
  display: block;
  min-width: 0;
  width: 100%;
  -webkit-animation-name: mui-auto-fill-cancel;
  animation-name: mui-auto-fill-cancel;
  -webkit-animation-duration: 10ms;
  animation-duration: 10ms;
  padding: 16.5px 14px;
  font-weight: 500;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid #fff;
  resize: none;
  box-sizing: border-box;
  // width: 300px;
  height: 67px;
  padding: 16px;
  font-size: 16px;
}

.action-buttons {
  display: flex;
  justify-content: space-between;
}

.btn-primary,
.btn-secondary {
  width: 48%;
  padding: 12px;
  font-size: 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
}

.btn-primary {
  background: #10b981;
  color: white;
  font-weight: bold;
}

.btn-primary:disabled {
  background: #d1d1d1;
}

.btn-secondary {
  background: transparent;
  border: 1px solid #10b981;
  color: #10b981;
  font-weight: bold;
}

.btn-wallet {
  width: 100%;
  padding: 12px;
  background: #10b981;
  color: white;
  font-weight: bold;
  border-radius: 8px;
  border: none;
  cursor: pointer;
}

.btn-wallet:hover {
  background: #1db786;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid rgba(0, 0, 0, 0.1);
  border-top: 5px solid #3498db; /* Blue color */
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
