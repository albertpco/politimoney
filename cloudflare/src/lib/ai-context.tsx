import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AiPageContext = {
  kind: string;
  name: string;
  id?: string;
  facts?: string[];
};

type AiContextValue = {
  context: AiPageContext | null;
  setContext: (ctx: AiPageContext | null) => void;
};

const AiContext = createContext<AiContextValue | null>(null);

export function AiContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<AiPageContext | null>(null);
  const value = useMemo(() => ({ context, setContext }), [context]);
  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAiContextValue(): AiPageContext | null {
  return useContext(AiContext)?.context ?? null;
}

export function useSetAiContext(ctx: AiPageContext | null) {
  const ctxApi = useContext(AiContext);
  const setContext = ctxApi?.setContext;
  const serialized = ctx ? JSON.stringify(ctx) : "";

  const apply = useCallback(() => {
    if (!setContext) return;
    setContext(serialized ? (JSON.parse(serialized) as AiPageContext) : null);
  }, [setContext, serialized]);

  useEffect(() => {
    apply();
    return () => {
      setContext?.(null);
    };
  }, [apply, setContext]);
}

export function buildPromptFromContext(
  pathname: string,
  url: string,
  ctx: AiPageContext | null,
): string {
  if (!ctx) {
    const section = pathname.split("/").filter(Boolean)[0] ?? "home";
    return [
      `I am reading this PolitiMoney ${section} page: ${url}`,
      "Help me understand what the public records on this page show.",
      "Focus on the named people, committees, votes, trades, source links, and dates.",
      "Do not assume motive. Separate what the records show from what still needs verification.",
    ].join("\n");
  }

  const lines = [
    `I am reading this PolitiMoney ${ctx.kind.toLowerCase()} page: ${url}`,
    `Subject: ${ctx.name}${ctx.id ? ` (${ctx.id})` : ""}.`,
  ];
  if (ctx.facts && ctx.facts.length) {
    lines.push("Key facts from the page:");
    for (const fact of ctx.facts) lines.push(`- ${fact}`);
  }
  lines.push(
    "Help me inspect the public records here. Focus on names, amounts, dates, source links, and what the data does not prove.",
    "Do not assume motive or causality. Note what would need a separate source to verify.",
  );
  return lines.join("\n");
}
