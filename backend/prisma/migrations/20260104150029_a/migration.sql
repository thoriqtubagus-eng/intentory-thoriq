-- AlterTable
ALTER TABLE "IncomingGoods" ADD COLUMN     "approvedById" TEXT;

-- AlterTable
ALTER TABLE "OutgoingGoods" ADD COLUMN     "approvedById" TEXT;

-- AddForeignKey
ALTER TABLE "IncomingGoods" ADD CONSTRAINT "IncomingGoods_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingGoods" ADD CONSTRAINT "OutgoingGoods_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
