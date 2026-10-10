-- CreateEnum
CREATE TYPE "Area" AS ENUM ('ZENTRUM', 'HOENGGERBERG');

-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "slotMinutes",
ADD COLUMN     "fromMinutes" INTEGER,
ADD COLUMN     "toMinutes" INTEGER;

-- CreateTable
CREATE TABLE "UserWeekday" (
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "area" "Area" NOT NULL,

    CONSTRAINT "UserWeekday_pkey" PRIMARY KEY ("userId","weekday")
);

-- CreateTable
CREATE TABLE "GroupDecision" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mensaId" TEXT NOT NULL,
    "slotMinutes" INTEGER NOT NULL,
    "committedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupDecision_groupId_date_key" ON "GroupDecision"("groupId", "date");

-- AddForeignKey
ALTER TABLE "UserWeekday" ADD CONSTRAINT "UserWeekday_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDecision" ADD CONSTRAINT "GroupDecision_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDecision" ADD CONSTRAINT "GroupDecision_mensaId_fkey" FOREIGN KEY ("mensaId") REFERENCES "Mensa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDecision" ADD CONSTRAINT "GroupDecision_committedById_fkey" FOREIGN KEY ("committedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

