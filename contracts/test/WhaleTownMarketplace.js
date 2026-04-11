const { expect } = require("chai");
const { ethers } = require("hardhat");

// ─── Helpers ────────────────────────────────────────────────────────────────

async function deployMockERC20(owner) {
  const ERC20 = await ethers.getContractFactory("MockERC20");
  return ERC20.deploy(owner.address, ethers.parseUnits("1000000", 6)); // 1M pathUSD
}

async function deployMockERC721() {
  const ERC721 = await ethers.getContractFactory("MockERC721");
  return ERC721.deploy();
}

async function deployMarketplace(paymentToken, feeRecipient, feeBps = 100) {
  const MP = await ethers.getContractFactory("WhaleTownMarketplace");
  return MP.deploy(await paymentToken.getAddress(), feeRecipient.address, feeBps);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("WhaleTownMarketplace", function () {
  let owner, seller1, seller2, buyer, feeRecipient;
  let pathUSD, nft, marketplace;
  let mpAddress, nftAddress;

  beforeEach(async () => {
    [owner, seller1, seller2, buyer, feeRecipient] = await ethers.getSigners();

    pathUSD = await deployMockERC20(owner);
    nft = await deployMockERC721();
    marketplace = await deployMarketplace(pathUSD, feeRecipient, 100); // 1% fee

    mpAddress = await marketplace.getAddress();
    nftAddress = await nft.getAddress();

    // Give buyer 100k pathUSD
    await pathUSD.transfer(buyer.address, ethers.parseUnits("100000", 6));

    // Mint NFTs to sellers
    await nft.mint(seller1.address, 0);
    await nft.mint(seller1.address, 1);
    await nft.mint(seller1.address, 2);
    await nft.mint(seller2.address, 3);
    await nft.mint(seller2.address, 4);

    // Approve marketplace to transfer NFTs
    await nft.connect(seller1).setApprovalForAll(mpAddress, true);
    await nft.connect(seller2).setApprovalForAll(mpAddress, true);
  });

  // ─── Single Buy ───────────────────────────────────────────────────────────

  describe("buy()", () => {
    it("executes a basic sale and distributes funds correctly", async () => {
      const price = ethers.parseUnits("100", 6); // 100 pathUSD
      await marketplace.connect(seller1).list(nftAddress, 0, price, 0);

      await pathUSD.connect(buyer).approve(mpAddress, price);

      const sellerBefore = await pathUSD.balanceOf(seller1.address);
      const feeBefore = await pathUSD.balanceOf(feeRecipient.address);

      await marketplace.connect(buyer).buy(0);

      const sellerAfter = await pathUSD.balanceOf(seller1.address);
      const feeAfter = await pathUSD.balanceOf(feeRecipient.address);

      // Platform fee = 1%
      expect(feeAfter - feeBefore).to.equal(ethers.parseUnits("1", 6));
      // Seller gets 99
      expect(sellerAfter - sellerBefore).to.equal(ethers.parseUnits("99", 6));
      // NFT transferred
      expect(await nft.ownerOf(0)).to.equal(buyer.address);
    });

    it("reverts on inactive listing", async () => {
      const price = ethers.parseUnits("100", 6);
      await marketplace.connect(seller1).list(nftAddress, 0, price, 0);
      await pathUSD.connect(buyer).approve(mpAddress, price * 2n);
      await marketplace.connect(buyer).buy(0);
      await expect(marketplace.connect(buyer).buy(0)).to.be.revertedWith("Not active");
    });
  });

  // ─── Batch Buy ────────────────────────────────────────────────────────────

  describe("batchBuy()", () => {
    const PRICE = ethers.parseUnits("50", 6); // 50 pathUSD each

    async function createListings() {
      // Listing 0: seller1 token 0
      await marketplace.connect(seller1).list(nftAddress, 0, PRICE, 0);
      // Listing 1: seller1 token 1
      await marketplace.connect(seller1).list(nftAddress, 1, PRICE, 0);
      // Listing 2: seller2 token 3
      await marketplace.connect(seller2).list(nftAddress, 3, PRICE, 0);
    }

    it("successfully buys all listings in a batch", async () => {
      await createListings();
      const total = PRICE * 3n;
      await pathUSD.connect(buyer).approve(mpAddress, total);

      const tx = await marketplace.connect(buyer).batchBuy([0, 1, 2]);
      const receipt = await tx.wait();

      expect(await nft.ownerOf(0)).to.equal(buyer.address);
      expect(await nft.ownerOf(1)).to.equal(buyer.address);
      expect(await nft.ownerOf(3)).to.equal(buyer.address);

      // Check BatchBuyResult events - all should be success
      const events = receipt.logs
        .filter(log => {
          try { return marketplace.interface.parseLog(log)?.name === "BatchBuyResult"; }
          catch { return false; }
        })
        .map(log => marketplace.interface.parseLog(log).args);

      expect(events).to.have.length(3);
      events.forEach(e => expect(e.success).to.be.true);
    });

    it("skips cancelled listings without reverting", async () => {
      await createListings();
      // Cancel listing 1 before batch
      await marketplace.connect(seller1).cancel(1);

      const total = PRICE * 2n; // only 2 will actually execute
      await pathUSD.connect(buyer).approve(mpAddress, total);

      const tx = await marketplace.connect(buyer).batchBuy([0, 1, 2]);
      const receipt = await tx.wait();

      // Token 0 and 3 transferred, token 1 stays with seller1
      expect(await nft.ownerOf(0)).to.equal(buyer.address);
      expect(await nft.ownerOf(1)).to.equal(seller1.address);
      expect(await nft.ownerOf(3)).to.equal(buyer.address);

      const events = receipt.logs
        .filter(log => {
          try { return marketplace.interface.parseLog(log)?.name === "BatchBuyResult"; }
          catch { return false; }
        })
        .map(log => marketplace.interface.parseLog(log).args);

      expect(events[0].success).to.be.true;  // listing 0 ok
      expect(events[1].success).to.be.false; // listing 1 cancelled
      expect(events[2].success).to.be.true;  // listing 2 ok
    });

    it("handles all listings being invalid without reverting", async () => {
      await createListings();
      // Buy all first so they're inactive
      await pathUSD.connect(buyer).approve(mpAddress, PRICE * 3n);
      await marketplace.connect(buyer).batchBuy([0, 1, 2]);

      // Try to batch buy again — all should fail gracefully
      await pathUSD.connect(buyer).approve(mpAddress, PRICE * 3n);
      const tx = await marketplace.connect(buyer).batchBuy([0, 1, 2]);
      const receipt = await tx.wait();

      const events = receipt.logs
        .filter(log => {
          try { return marketplace.interface.parseLog(log)?.name === "BatchBuyResult"; }
          catch { return false; }
        })
        .map(log => marketplace.interface.parseLog(log).args);

      events.forEach(e => expect(e.success).to.be.false);
    });

    it("handles partial failures mid-batch (mix of valid and invalid)", async () => {
      await createListings();
      // Manually buy listing 1 so it's gone
      await pathUSD.connect(buyer).approve(mpAddress, PRICE);
      await marketplace.connect(buyer).buy(1);

      // Now batch [0, 1, 2] — listing 1 is dead
      await pathUSD.connect(buyer).approve(mpAddress, PRICE * 2n);
      const tx = await marketplace.connect(buyer).batchBuy([0, 1, 2]);
      const receipt = await tx.wait();

      expect(await nft.ownerOf(0)).to.equal(buyer.address);
      expect(await nft.ownerOf(3)).to.equal(buyer.address);

      const events = receipt.logs
        .filter(log => {
          try { return marketplace.interface.parseLog(log)?.name === "BatchBuyResult"; }
          catch { return false; }
        })
        .map(log => marketplace.interface.parseLog(log).args);

      expect(events[0].success).to.be.true;
      expect(events[1].success).to.be.false;
      expect(events[2].success).to.be.true;
    });

    it("reverts if allowance is insufficient for valid listings", async () => {
      await createListings();
      // Only approve for 1 but try to buy 3
      await pathUSD.connect(buyer).approve(mpAddress, PRICE);
      await expect(marketplace.connect(buyer).batchBuy([0, 1, 2]))
        .to.be.revertedWith("Insufficient allowance for batch");
    });
  });

  // ─── Collection Royalty Override ──────────────────────────────────────────

  describe("setCollectionRoyalty()", () => {
    it("owner can set a royalty override and it is paid on sale", async () => {
      const royaltyRecipient = seller2; // arbitrary wallet
      // Set 7% royalty for the nft collection
      await marketplace.connect(owner).setCollectionRoyalty(
        nftAddress, royaltyRecipient.address, 700
      );

      const price = ethers.parseUnits("100", 6);
      await marketplace.connect(seller1).list(nftAddress, 0, price, 0);
      await pathUSD.connect(buyer).approve(mpAddress, price);

      const royaltyBefore = await pathUSD.balanceOf(royaltyRecipient.address);
      await marketplace.connect(buyer).buy(0);
      const royaltyAfter = await pathUSD.balanceOf(royaltyRecipient.address);

      // 7% of 100 = 7 pathUSD
      expect(royaltyAfter - royaltyBefore).to.equal(ethers.parseUnits("7", 6));
    });

    it("reverts if royalty exceeds 10%", async () => {
      await expect(
        marketplace.connect(owner).setCollectionRoyalty(nftAddress, owner.address, 1001)
      ).to.be.revertedWith("Royalty too high");
    });

    it("non-owner cannot set royalty", async () => {
      await expect(
        marketplace.connect(buyer).setCollectionRoyalty(nftAddress, buyer.address, 500)
      ).to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
    });
  });

  // ─── Cancel ───────────────────────────────────────────────────────────────

  describe("cancel()", () => {
    it("seller can cancel their own listing", async () => {
      const price = ethers.parseUnits("100", 6);
      await marketplace.connect(seller1).list(nftAddress, 0, price, 0);
      await marketplace.connect(seller1).cancel(0);
      expect(await marketplace.isListingValid(0)).to.be.false;
    });

    it("owner can cancel any listing", async () => {
      const price = ethers.parseUnits("100", 6);
      await marketplace.connect(seller1).list(nftAddress, 0, price, 0);
      await marketplace.connect(owner).cancel(0);
      expect(await marketplace.isListingValid(0)).to.be.false;
    });

    it("random address cannot cancel", async () => {
      const price = ethers.parseUnits("100", 6);
      await marketplace.connect(seller1).list(nftAddress, 0, price, 0);
      await expect(marketplace.connect(buyer).cancel(0)).to.be.revertedWith("Not authorized");
    });
  });
});
