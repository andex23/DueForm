export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}

export interface BusinessProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  tagline: string;
  logoDataUrl?: string;
  isDefault: boolean;
}

export interface ClientInfo {
  id?: string;
  name: string;
  email: string;
  address: string;
  phone: string;
  company: string;
}

export interface SavedService {
  id: string;
  name: string;
  description: string;
  defaultRate: number;
  defaultTax: number;
}

// ─── Payment Methods ───

export type PaymentMethodType = "bank" | "crypto" | "paypal";

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  label: string;
  // Bank
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  routingNumber?: string;
  // Crypto
  cryptoCurrency?: string;
  network?: string;
  walletAddress?: string;
  // PayPal
  paypalEmail?: string;
  paypalMe?: string;
}

export interface PaymentInfo {
  methods: PaymentMethod[];
  paymentLink: string;
  paymentNote: string;
}

export interface EmailSenderSettings {
  fromName: string;
  fromEmail: string;
}

export type EmailDeliveryStatus = "idle" | "sent" | "failed";

export interface EmailDeliveryState {
  status: EmailDeliveryStatus;
  lastSentAt?: string;
  lastSentTo?: string;
  lastSubject?: string;
  lastMessageId?: string;
  lastError?: string;
}

export interface ReminderRule {
  id: string;
  label: string;
  offsetDays: number;
  enabled: boolean;
}

export interface ReminderLog {
  id: string;
  ruleId?: string;
  sentAt: string;
  to: string;
  subject: string;
  status: "sent" | "failed";
  messageId?: string;
  error?: string;
}

// ─── Partial Payments ───

export interface PartialPayment {
  id: string;
  amount: number;
  date: string;
  note: string;
}

// ─── Currency ───

export type CurrencyCode = "USD" | "NGN" | "GBP" | "EUR" | "MXN" | "PHP" | "ARS" | "COP";

export interface CurrencyOption {
  code: CurrencyCode;
  symbol: string;
  name: string;
}

export interface CryptoCurrencyOption {
  code: string;
  name: string;
}

export interface CryptoNetworkOption {
  value: string;
  label: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "MXN", symbol: "$", name: "Mexican Peso" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso" },
  { code: "ARS", symbol: "$", name: "Argentine Peso" },
  { code: "COP", symbol: "$", name: "Colombian Peso" },
];

export const CRYPTO_CURRENCIES: CryptoCurrencyOption[] = [
  { code: "BTC", name: "Bitcoin" },
  { code: "ETH", name: "Ethereum" },
  { code: "USDT", name: "Tether" },
  { code: "USDC", name: "USD Coin" },
  { code: "BNB", name: "BNB" },
  { code: "SOL", name: "Solana" },
  { code: "TRX", name: "TRON" },
  { code: "DOGE", name: "Dogecoin" },
  { code: "XRP", name: "XRP" },
  { code: "ADA", name: "Cardano" },
  { code: "TON", name: "Toncoin" },
  { code: "AVAX", name: "Avalanche" },
  { code: "POL", name: "Polygon" },
  { code: "LTC", name: "Litecoin" },
  { code: "BCH", name: "Bitcoin Cash" },
  { code: "DOT", name: "Polkadot" },
  { code: "LINK", name: "Chainlink" },
  { code: "DAI", name: "Dai" },
  { code: "XLM", name: "Stellar" },
  { code: "ATOM", name: "Cosmos" },
  { code: "APT", name: "Aptos" },
  { code: "ARB", name: "Arbitrum" },
  { code: "OP", name: "Optimism" },
  { code: "XMR", name: "Monero" },
  { code: "ETC", name: "Ethereum Classic" },
];

export const CRYPTO_NETWORKS: CryptoNetworkOption[] = [
  { value: "Bitcoin", label: "Bitcoin" },
  { value: "Lightning", label: "Lightning" },
  { value: "Ethereum", label: "Ethereum" },
  { value: "ERC-20", label: "ERC-20 (Ethereum)" },
  { value: "TRC-20", label: "TRC-20 (TRON)" },
  { value: "BEP-20", label: "BEP-20 (BNB Smart Chain)" },
  { value: "Solana", label: "Solana" },
  { value: "Polygon", label: "Polygon" },
  { value: "Arbitrum One", label: "Arbitrum One" },
  { value: "Optimism", label: "Optimism" },
  { value: "Base", label: "Base" },
  { value: "Avalanche C-Chain", label: "Avalanche C-Chain" },
  { value: "TON", label: "TON" },
  { value: "XRP Ledger", label: "XRP Ledger" },
  { value: "Cardano", label: "Cardano" },
  { value: "Dogecoin", label: "Dogecoin" },
  { value: "Litecoin", label: "Litecoin" },
  { value: "Stellar", label: "Stellar" },
  { value: "Cosmos", label: "Cosmos" },
  { value: "Aptos", label: "Aptos" },
  { value: "Monero", label: "Monero" },
  { value: "Bitcoin Cash", label: "Bitcoin Cash" },
  { value: "Polkadot", label: "Polkadot" },
  { value: "Ethereum Classic", label: "Ethereum Classic" },
];

export function getCryptoNetworkOptions(
  currentNetwork?: string
): CryptoNetworkOption[] {
  if (!currentNetwork?.trim()) {
    return CRYPTO_NETWORKS;
  }

  const normalizedCurrent = currentNetwork.trim().toUpperCase();
  const hasExistingOption = CRYPTO_NETWORKS.some(
    (network) => network.value.toUpperCase() === normalizedCurrent
  );

  if (hasExistingOption) {
    return CRYPTO_NETWORKS;
  }

  return [
    {
      value: currentNetwork.trim(),
      label: `${currentNetwork.trim()} (saved)`,
    },
    ...CRYPTO_NETWORKS,
  ];
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "partially_paid" | "overdue";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  businessId: string;
  business: BusinessProfile;
  client: ClientInfo;
  lineItems: LineItem[];
  taxRate: number;
  notes: string;
  paymentTerms: string;
  paymentInfo: PaymentInfo;
  payments: PartialPayment[];
  currency: CurrencyCode;
  dateIssued: string;
  dateDue: string;
  sentAt?: string;
  publicToken?: string;
  publicEnabled?: boolean;
  emailDelivery?: EmailDeliveryState;
  reminderRules?: ReminderRule[];
  reminderHistory?: ReminderLog[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSnapshot {
  version: number;
  counter: number;
  invoices: Invoice[];
  businesses: BusinessProfile[];
  clients: ClientInfo[];
  services: SavedService[];
  paymentInfo: PaymentInfo;
  emailSender: EmailSenderSettings;
  exportedAt: string;
}
