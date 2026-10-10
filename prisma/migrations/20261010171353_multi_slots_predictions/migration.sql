-- AlterTable
ALTER TABLE "Dish" ADD COLUMN     "predictedAt" TIMESTAMP(3),
ADD COLUMN     "predictedN" INTEGER,
ADD COLUMN     "predictedScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "fromMinutes",
DROP COLUMN "toMinutes",
ADD COLUMN     "slots" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "DishEmbedding" (
    "dishId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "vector" DOUBLE PRECISION[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DishEmbedding_pkey" PRIMARY KEY ("dishId")
);

-- AddForeignKey
ALTER TABLE "DishEmbedding" ADD CONSTRAINT "DishEmbedding_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

