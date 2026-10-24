// DIBUAT OTOMATIS oleh Project/contracts/script/export.mjs. Jangan diedit manual.
export const fotokopiKilatAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "nama_",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "simbol_",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "batasAntre_",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "LANGKAH_TERTINGGI",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_LANGKAH",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_TEXT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_TOKO",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "batasAntre",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claim",
    "inputs": [
      {
        "name": "id",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "completeStep",
    "inputs": [
      {
        "name": "id",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "kode",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createOrder",
    "inputs": [
      {
        "name": "jenis",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "teks",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "daftarToko",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "endSession",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "expire",
    "inputs": [
      {
        "name": "id",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getApproved",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getOrder",
    "inputs": [
      {
        "name": "id",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct FotokopiKilat.Order",
        "components": [
          {
            "name": "pelanggan",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "harga",
            "type": "uint96",
            "internalType": "uint96"
          },
          {
            "name": "toko",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "jenis",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "langkah",
            "type": "bytes4",
            "internalType": "bytes4"
          },
          {
            "name": "jumlahLangkah",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "langkahSelesai",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum FotokopiKilat.Status"
          },
          {
            "name": "dibuatPada",
            "type": "uint40",
            "internalType": "uint40"
          },
          {
            "name": "diclaimPada",
            "type": "uint40",
            "internalType": "uint40"
          },
          {
            "name": "batasKerja",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "sesi",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "kerja",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "teks",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isApprovedForAll",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "operator",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "jumlahToko",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "katalog",
    "inputs": [
      {
        "name": "jenis",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "harga",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "batasKerja",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "langkah",
        "type": "bytes4",
        "internalType": "bytes4"
      },
      {
        "name": "jumlahLangkah",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "aktif",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "label",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "langkahKatalog",
    "inputs": [
      {
        "name": "jenis",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "urutan",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nextId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "omzet",
    "inputs": [
      {
        "name": "sesi",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "toko",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "operator",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "order",
    "inputs": [
      {
        "name": "id",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "pelanggan",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "harga",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "toko",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "jenis",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "langkah",
        "type": "bytes4",
        "internalType": "bytes4"
      },
      {
        "name": "jumlahLangkah",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "langkahSelesai",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "status",
        "type": "uint8",
        "internalType": "enum FotokopiKilat.Status"
      },
      {
        "name": "dibuatPada",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "diclaimPada",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "batasKerja",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "sesi",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "kerja",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "teks",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ownerOf",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "payoutSekarang",
    "inputs": [
      {
        "name": "id",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pemenang",
    "inputs": [
      {
        "name": "sesi",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "terbaik",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "omzetTerbaik",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registerShop",
    "inputs": [
      {
        "name": "alamat",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "nama",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "safeTransferFrom",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "safeTransferFrom",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "data",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "sesiAktif",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "sesiId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setApprovalForAll",
    "inputs": [
      {
        "name": "operator",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "approved",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setKatalog",
    "inputs": [
      {
        "name": "jenis",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "harga",
        "type": "uint96",
        "internalType": "uint96"
      },
      {
        "name": "batasKerja",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "langkah",
        "type": "uint8[]",
        "internalType": "uint8[]"
      },
      {
        "name": "label",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "startSession",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "supportsInterface",
    "inputs": [
      {
        "name": "interfaceId",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "symbol",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "tertunda",
    "inputs": [
      {
        "name": "penerima",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "tokenURI",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "toko",
    "inputs": [
      {
        "name": "alamat",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "terdaftar",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "orderAktif",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "nama",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferFrom",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdraw",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Approval",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "approved",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ApprovalForAll",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "operator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "approved",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "KatalogSet",
    "inputs": [
      {
        "name": "jenis",
        "type": "uint8",
        "indexed": true,
        "internalType": "uint8"
      },
      {
        "name": "harga",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "batasKerja",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "langkah",
        "type": "bytes4",
        "indexed": false,
        "internalType": "bytes4"
      },
      {
        "name": "jumlahLangkah",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "label",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OrderClaimed",
    "inputs": [
      {
        "name": "id",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "toko",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "diclaimPada",
        "type": "uint40",
        "indexed": false,
        "internalType": "uint40"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OrderCreated",
    "inputs": [
      {
        "name": "id",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "pelanggan",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "jenis",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "harga",
        "type": "uint96",
        "indexed": false,
        "internalType": "uint96"
      },
      {
        "name": "teks",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "dibuatPada",
        "type": "uint40",
        "indexed": false,
        "internalType": "uint40"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OrderExpired",
    "inputs": [
      {
        "name": "id",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "refund",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "alasan",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum FotokopiKilat.AlasanExpire"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OrderFinished",
    "inputs": [
      {
        "name": "id",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "toko",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "payout",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "refund",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "kerja",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SessionEnded",
    "inputs": [
      {
        "name": "sesiId",
        "type": "uint32",
        "indexed": true,
        "internalType": "uint32"
      },
      {
        "name": "waktu",
        "type": "uint40",
        "indexed": false,
        "internalType": "uint40"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SessionStarted",
    "inputs": [
      {
        "name": "sesiId",
        "type": "uint32",
        "indexed": true,
        "internalType": "uint32"
      },
      {
        "name": "waktu",
        "type": "uint40",
        "indexed": false,
        "internalType": "uint40"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ShopRegistered",
    "inputs": [
      {
        "name": "toko",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "nama",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "StepCompleted",
    "inputs": [
      {
        "name": "id",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "toko",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "urutan",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "kode",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TransferTertunda",
    "inputs": [
      {
        "name": "penerima",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "jumlah",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Withdrawn",
    "inputs": [
      {
        "name": "penerima",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "jumlah",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyClaimed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadKind",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadRecipe",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadText",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadValue",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ERC721IncorrectOwner",
    "inputs": [
      {
        "name": "sender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC721InsufficientApproval",
    "inputs": [
      {
        "name": "operator",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC721InvalidApprover",
    "inputs": [
      {
        "name": "approver",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC721InvalidOperator",
    "inputs": [
      {
        "name": "operator",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC721InvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC721InvalidReceiver",
    "inputs": [
      {
        "name": "receiver",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC721InvalidSender",
    "inputs": [
      {
        "name": "sender",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC721NonexistentToken",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "Late",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotClaimed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOperator",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotShop",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotYourOrder",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NothingToWithdraw",
    "inputs": []
  },
  {
    "type": "error",
    "name": "QueueTimeout",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SessionClosed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SessionOpen",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ShopBusy",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ShopExists",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TooManyShops",
    "inputs": []
  },
  {
    "type": "error",
    "name": "WrongStep",
    "inputs": []
  }
] as const;

export const deployments = {
  "31337": {
    "address": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    "operator": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "tokoA": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "tokoB": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "batasAntre": 45,
    "deployBlock": 2
  }
} as const;
