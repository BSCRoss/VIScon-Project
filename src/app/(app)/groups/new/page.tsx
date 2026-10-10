import { CreateGroupForm } from "@/components/forms/GroupForms";

export default function NewGroupPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New group</h1>
      <CreateGroupForm />
    </div>
  );
}
