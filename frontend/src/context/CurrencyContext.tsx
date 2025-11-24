import { createContext, useContext, ReactNode } from "react";

type Currency = "ZMW";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatCurrency: (amount: number, sourceCurrency?: string) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const currency: Currency = "ZMW";

  const setCurrency = (newCurrency: Currency) => {
    // Currency is now fixed to ZMW, this function kept for compatibility
  };

  const formatCurrency = (amount: number, sourceCurrency: string = "ZMW"): string => {
    // Always display in ZMW
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "ZMW",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return context;
};
