import { AppHeader } from "@/components/AppHeader";
import { CreateGroupForm } from "@/components/forms/GroupForms";

export default function NewGroupPage() {
  return (
    <div>
      <AppHeader eyebrow="People" title="New group" subtitle="Give it a name, then invite people by username." />
      <div className="card"><CreateGroupForm /></div>
    </div>
  );
}
