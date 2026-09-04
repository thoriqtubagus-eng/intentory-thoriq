/*
  Warnings:

  - Added the required column `createdById` to the `IncomingGoods` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "IncomingGoods" ADD COLUMN     "createdById" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "IncomingGoods" ADD CONSTRAINT "IncomingGoods_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
