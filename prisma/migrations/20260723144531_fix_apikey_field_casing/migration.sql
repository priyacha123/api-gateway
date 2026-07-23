/*
  Warnings:

  - You are about to drop the column `KeyPrefix` on the `ApiKey` table. All the data in the column will be lost.
  - Added the required column `keyPrefix` to the `ApiKey` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ApiKey" DROP COLUMN "KeyPrefix",
ADD COLUMN     "keyPrefix" TEXT NOT NULL;
