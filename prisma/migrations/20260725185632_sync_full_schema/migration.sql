/*
  Warnings:

  - You are about to drop the column `stripeCustomerId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[razorpaySubscriptionId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_stripeCustomerId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "stripeCustomerId",
ADD COLUMN     "razorpaySubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_razorpaySubscriptionId_key" ON "User"("razorpaySubscriptionId");
