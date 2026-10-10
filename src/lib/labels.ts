import type { Campus, QueueBucket } from "@prisma/client";

export const CAMPUS_LABEL: Record<Campus, string> = {
  ETH_ZENTRUM: "ETH Zentrum",
  ETH_HOENGGERBERG: "ETH Hönggerberg",
  ETH_OERLIKON: "ETH Oerlikon",
  ETH_BASEL: "ETH Basel",
  UZH_ZENTRUM: "UZH Zentrum",
  UZH_IRCHEL: "UZH Irchel",
  UZH_OERLIKON: "UZH Oerlikon",
  OTHER: "Other",
};

export const CAMPUS_ORDER: Campus[] = ["ETH_ZENTRUM", "ETH_HOENGGERBERG", "UZH_ZENTRUM", "UZH_IRCHEL", "UZH_OERLIKON", "ETH_OERLIKON", "ETH_BASEL", "OTHER"];

export const QUEUE_LABEL: Record<QueueBucket, string> = { NONE: "No queue", LT10: "< 10 people", B10_30: "10–30 people", GT30: "> 30 people" };

export const SWIPE_LABEL: Record<number, string> = { 2: "👍👍", 1: "👍", [-1]: "👎", [-2]: "👎👎" };
