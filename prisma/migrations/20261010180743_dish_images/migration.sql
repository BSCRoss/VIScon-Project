-- CreateTable
CREATE TABLE "DishImage" (
    "dishId" TEXT NOT NULL,
    "thumb" BYTEA NOT NULL,
    "medium" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DishImage_pkey" PRIMARY KEY ("dishId")
);

-- AddForeignKey
ALTER TABLE "DishImage" ADD CONSTRAINT "DishImage_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

