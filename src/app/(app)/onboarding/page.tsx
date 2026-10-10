import type { Area } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getActiveMensas, getAllergens } from "@/lib/queries/today";
import { CAMPUS_LABEL, CAMPUS_ORDER } from "@/lib/labels";
import { areaOfCampus, WEEKDAYS } from "@/lib/area";
import { AppHeader } from "@/components/AppHeader";
import { OnboardingForm } from "@/components/forms/OnboardingForm";

export default async function OnboardingPage() {
  const user = await requireUser();
  const [mensas, allergens, me] = await Promise.all([
    getActiveMensas(),
    getAllergens(),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { mensas: true, allergens: true, weekdays: true } }),
  ]);
  const mensasByCampus = CAMPUS_ORDER.map((campus) => ({
    campus,
    label: CAMPUS_LABEL[campus],
    area: areaOfCampus(campus),
    mensas: mensas.filter((m) => m.campus === campus).map((m) => ({ id: m.id, name: m.name, area: areaOfCampus(m.campus) })),
  })).filter((g) => g.mensas.length > 0);
  const weekdays: Record<number, Area | "OFF"> = {};
  for (const wd of WEEKDAYS) weekdays[wd] = me.weekdays.find((w) => w.weekday === wd)?.area ?? (me.weekdays.length === 0 ? "ZENTRUM" : "OFF");
  const firstTime = me.mensas.length === 0;

  return (
    <div>
      <AppHeader title={firstTime ? "Set up your lunch" : "Your preferences"} subtitle={firstTime ? "Three quick questions, then you're in." : "Edit where you are and which mensas you follow."} />
      <OnboardingForm
        mensasByCampus={mensasByCampus}
        allergens={allergens.map((a) => ({ id: a.id, nameEn: a.nameEn }))}
        selectedMensaIds={me.mensas.map((m) => m.mensaId)}
        selectedAllergenIds={me.allergens.map((a) => a.allergenId)}
        weekdays={weekdays}
        vegetarian={me.vegetarian}
        vegan={me.vegan}
      />
    </div>
  );
}
