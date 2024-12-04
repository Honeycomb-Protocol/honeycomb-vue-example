import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import SolanaWallets from "solana-wallets-vue";
import "solana-wallets-vue/styles.css";
import { createApp } from "vue";
import ToastPlugin from "vue-toast-notification";
import "vue-toast-notification/dist/theme-bootstrap.css";
import App from "./App.vue";
import router from "./router";
import store from "./store";

const walletOptions = {
  wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
  autoConnect: true,
};

// Create the Vue app instance
createApp(App)
  .use(store)
  .use(router)
  .use(SolanaWallets, walletOptions) // Use Solana Wallet plugin
  .use(ToastPlugin)
  .mount("#app");
