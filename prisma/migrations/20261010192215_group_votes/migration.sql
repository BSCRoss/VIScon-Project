-- AlterTable
ALTER TABLE "GroupDecision" ADD COLUMN     "method" TEXT NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "GroupVote" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "userId" TEXT NOT NULL,
    "mensaId" TEXT NOT NULL,
    "slotMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupVote_groupId_date_userId_key" ON "GroupVote"("groupId", "date", "userId");

-- AddForeignKey
ALTER TABLE "GroupVote" ADD CONSTRAINT "GroupVote_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupVote" ADD CONSTRAINT "GroupVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupVote" ADD CONSTRAINT "GroupVote_mensaId_fkey" FOREIGN KEY ("mensaId") REFERENCES "Mensa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

