export type Plan = {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

// Planos de licença de exemplo. Ajuste os valores e recursos conforme o produto real.
export const plans: Plan[] = [
  {
    id: "basic",
    name: "Básico",
    price: 49,
    period: "/mês",
    description: "Para quem está começando e precisa do essencial.",
    features: ["1 licença", "Ativação em 1 dispositivo", "Suporte por e-mail"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 99,
    period: "/mês",
    description: "Para profissionais que precisam de mais flexibilidade.",
    features: [
      "5 licenças",
      "Ativação em até 5 dispositivos",
      "Suporte prioritário",
      "Atualizações incluídas",
    ],
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Empresarial",
    price: 299,
    period: "/mês",
    description: "Para equipes e empresas com necessidades maiores.",
    features: [
      "Licenças ilimitadas",
      "Ativação em dispositivos ilimitados",
      "Suporte dedicado 24/7",
      "SLA garantido",
    ],
  },
];
