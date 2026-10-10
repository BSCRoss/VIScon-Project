import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getActiveMensas, getAllergens } from "@/lib/queries/today";
import { CAMPUS_LABEL, CAMPUS_ORDER } from "@/lib/labels";
import { OnboardingForm } from "@/components/forms/OnboardingForm";

export default async function OnboardingPage() {
  const user = await requireUser();
  const [mensas, allergens, me] = await Promise.all([
    getActiveMensas(),
    getAllergens(),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { mensas: true, allergens: true } }),
  ]);
  const mensasByCampus = CAMPUS_ORDER.map((campus) => ({
    campus,
    label: CAMPUS_LABEL[campus],
    mensas: mensas.filter((m) => m.campus === campus).map((m) => ({ id: m.id, name: m.name })),
  })).filter((g) => g.mensas.length > 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Set up your lunch</h1>
      <OnboardingForm
        mensasByCampus={mensasByCampus}
        allergens={allergens.map((a) => ({ id: a.id, nameEn: a.nameEn }))}
        selectedMensaIds={me.mensas.map((m) => m.mensaId)}
        selectedAllergenIds={me.allergens.map((a) => a.allergenId)}
        vegetarian={me.vegetarian}
        vegan={me.vegan}
      />
    </div>
  );
}
