export type Plan = {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

// Planos de licença por período. Ajuste os valores e recursos conforme o produto real.
export const plans: Plan[] = [
  {
    id: "mensal",
    name: "Mensal",
    price: 25,
    period: "/mês",
    description: "Ideal para testar e usar sem compromisso de longo prazo.",
    features: [
      "Acesso completo por 1 mês",
      "Ativação imediata",
      "Suporte por e-mail",
    ],
  },
  {
    id: "semestral",
    name: "Semestral",
    price: 100,
    period: "/semestre",
    description: "6 meses de acesso com economia em relação ao mensal.",
    features: [
      "Acesso completo por 6 meses",
      "Ativação imediata",
      "Suporte prioritário",
      "Atualizações incluídas",
    ],
  },
  {
    id: "anual",
    name: "Anual",
    price: 150,
    period: "/ano",
    description: "12 meses de acesso pelo melhor custo-benefício.",
    features: [
      "Acesso completo por 12 meses",
      "Ativação imediata",
      "Suporte prioritário",
      "Atualizações incluídas",
    ],
    highlighted: true,
  },
];
