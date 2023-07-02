import { PublicKey, Transaction, ConfirmedSignatureInfo, Connection, Cluster, ParsedTransactionWithMeta } from '@solana/web3.js';
import { ReprScalar, IncompleteCommitment, Commitment } from 'elusiv-cryptojs';
import { SendQuadraProof } from 'elusiv-circuits';

declare const TokenTypeArr: readonly ["LAMPORTS", "USDC", "USDT", "mSOL", "BONK", "SAMO"];
type TokenType = typeof TokenTypeArr[number];

type OptionalFee = {
    collector: PublicKey;
    amount: bigint;
};
type BasicFee = {
    readonly tokenType: TokenType;
    readonly txFee: number;
    readonly privacyFee: number;
    readonly tokenAccRent: number;
    readonly lamportsPerToken?: number;
};
type Fee = BasicFee & {
    readonly extraFee: number;
};
declare function getTotalFeeAmount(f: Fee): number;
declare function getComputationFeeTotal(f: Fee): number;

type FeeCalcInfo = {
    amount: number;
    tokenType: TokenType;
};
type SendFeeCalcInfo = FeeCalcInfo & {
    recipient: PublicKey;
    extraFee?: OptionalFee;
    customRecipientTA?: PublicKey;
};
type TopupFeeCalcInfo = FeeCalcInfo;

type TxTypes = 'TOPUP' | 'SEND';

type WardenInfo = {
    url: string;
    pubKey: PublicKey;
};

declare abstract class SharedTxData {
    readonly txType: TxTypes;
    protected readonly fee: Fee;
    readonly tokenType: TokenType;
    readonly lastNonce: number;
    readonly commitmentHash: ReprScalar;
    readonly merkleStartIndex: number;
    readonly wardenInfo: WardenInfo;
    constructor(txType: TxTypes, fee: Fee, tokenType: TokenType, lastNonce: number, commitmentHash: ReprScalar, merkleStartIndex: number, wardenInfo: WardenInfo);
    getTotalFee(): Fee;
    getTotalFeeAmount(): number;
}

declare class SendTxData extends SharedTxData {
    readonly proof: SendQuadraProof;
    readonly extraFee: OptionalFee;
    readonly isSolanaPayTransfer: boolean;
    constructor(fee: Fee, tokenType: TokenType, lastNonce: number, commitmentHash: ReprScalar, merkleStartIndex: number, wardenInfo: WardenInfo, proof: SendQuadraProof, isSolanaPayTransfer: boolean, extraFee: OptionalFee);
}

declare class TopupTxData extends SharedTxData {
    tx: Transaction;
    private signed;
    readonly hashAccIndex: number;
    readonly merge: boolean;
    constructor(fee: Fee, tokenType: TokenType, lastNonce: number, commitmentHash: ReprScalar, merkleStartIndex: number, wardenInfo: WardenInfo, tx: Transaction, hashAccIndex: number, merge: boolean);
    setSignedTx(tx: Transaction): void;
    isSigned(): boolean;
}

type ElusivTxData = SendTxData | TopupTxData;

type TransactionStatus = 'PENDING' | 'PROCESSED' | 'CONFIRMED';

type ElusivTransaction = {
    nonce: number;
    txType: TxTypes;
    tokenType: TokenType;
    identifier: PublicKey;
    amount: bigint;
    fee: bigint;
    commitmentHash: ReprScalar;
    merkleStartIndex: number;
    warden: PublicKey;
    transactionStatus?: TransactionStatus;
    signature?: ConfirmedSignatureInfo;
};

type PrivateTxWrapperShared = {
    readonly txType: TxTypes;
    readonly amount: number;
    readonly fee: number;
    readonly sig: ConfirmedSignatureInfo;
    readonly tokenType: TokenType;
    transactionStatus?: TransactionStatus;
    warden: PublicKey;
    nonce: number;
};
type SendTxWrapper = PrivateTxWrapperShared & {
    readonly recipient: PublicKey | undefined;
    readonly isSolanaPayTransfer: boolean;
    readonly reference: PublicKey | undefined;
    readonly extraFee: number;
    readonly memo: string | undefined;
};
type TopUpTxWrapper = {
    readonly origin: PublicKey;
} & PrivateTxWrapperShared;
type PrivateTxWrapper = TopUpTxWrapper | SendTxWrapper;

type EncryptedValue = {
    cipherText: Uint8Array;
    iv: Uint8Array;
};

declare class RVKWrapper {
    private readonly getIdentifierKeyClosure;
    private readonly generateAES256KeyClosure;
    private readonly encryptAES256Closure;
    private readonly decryptAES256Closure;
    private readonly getRootViewingKeyClosure;
    private readonly encryptCommMetadataClosure;
    private readonly decryptCommMetadataClosure;
    constructor(rvk: Uint8Array);
    getRootViewingKey(): Uint8Array;
    getIdentifierKey(nonce: number): PublicKey;
    generateDecryptionKey(nonce: number): Uint8Array;
    encryptSeededSaltedAES256(payload: Uint8Array, nonce: number): Promise<EncryptedValue>;
    decryptSeededSaltedAES256(cipherText: EncryptedValue, nonce: number): Promise<Uint8Array>;
    encryptMetadata(metadata: Uint8Array, commHash: Uint8Array): Promise<EncryptedValue>;
    decryptMetadata(metadata: Uint8Array, commHash: Uint8Array): Promise<Uint8Array>;
}

type ViewingKey = {
    version: string;
    idKey: string;
    decryptionKey: string;
};
declare function getSendTxWithViewingKey(connection: Connection, cluster: Cluster, sendTx: ViewingKey): Promise<{
    sendTx: SendTxWrapper;
    owner: PublicKey;
}>;

declare class GeneralSet<T> {
    private map;
    private getId;
    constructor(getId: (a: T) => string);
    add(item: T): void;
    addArr(item: readonly T[]): void;
    values(): IterableIterator<T>;
    delete(item: T): boolean;
    toArray(): T[];
    size(): number;
}

declare class CommitmentMetadata {
    readonly nonce: number;
    readonly tokenType: TokenType;
    readonly assocCommIndex: number;
    readonly balance: bigint;
    constructor(nonce: number, tokenType: TokenType, assocCommIndex: number, balance: bigint);
    serializeAndEncrypt(rvk: RVKWrapper, commHash: Uint8Array): Promise<EncryptedValue>;
    static deserializeAndDecrypt(cipherText: Uint8Array, rvk: RVKWrapper, commHash: Uint8Array): Promise<CommitmentMetadata>;
    toBytes(): Uint8Array;
    static fromBytes(serializedMetadata: Uint8Array): CommitmentMetadata;
    static fromCommitment(nonce: number, comm: IncompleteCommitment): CommitmentMetadata;
}

type PartialSendTx = ElusivTransaction & {
    isAssociatedTokenAcc: boolean;
    isSolanaPayTransfer: boolean;
    metadata?: CommitmentMetadata;
    recipient?: PublicKey;
    encryptedOwner?: EncryptedValue;
    owner?: PublicKey;
    refKey?: PublicKey;
    memo?: string;
    inputCommitments?: GeneralSet<Commitment>;
    proof?: SendQuadraProof;
    extraFee: OptionalFee;
};
type SendTx = PartialSendTx & {
    commitment: IncompleteCommitment;
};

type PartialStoreTx = ElusivTransaction & {
    sender: PublicKey;
    parsedPrivateBalance: bigint;
    hashAccIndex: number;
    isRecipient: boolean;
};

type Pair<T, U> = {
    fst: T;
    snd: U;
};

type CommitmentInfo = {
    index: number;
    opening: bigint[];
    root: bigint;
};
declare class TreeManager {
    private storageReader;
    private constructor();
    static createTreeManager(connection: Connection, cluster: Cluster): TreeManager;
    getRoot(): Promise<bigint>;
    getLatestLeafIndex(): Promise<number>;
    getCommitmentsInfo(commitments: Pair<ReprScalar, number>[]): Promise<CommitmentInfo[]>;
    hasCommitment(commitmentHash: ReprScalar, leafStartPointer: number): Promise<boolean>;
    private getCommitmentIndices;
    private getOpenings;
    private getOpeningIndices;
    private getOpeningIndicesInner;
    private static parseTreeBytesToBigInt;
    private static getDefault;
}

declare abstract class TransactionCacher {
    private fetchedTxs;
    constructor();
    protected cache(txs: ElusivTransaction[]): void;
    protected cacheOverwrite(txs: ElusivTransaction[]): void;
    protected isCached(tx: ElusivTransaction): boolean;
    protected getAtNonceFromCache(nonce: number): ElusivTransaction[] | undefined;
    protected getCachedTxs(tokenType?: TokenType, fromNonce?: number, toNonce?: number | undefined): ElusivTransaction[];
    private getAllCachedTxs;
}

declare abstract class AbstractTxManager extends TransactionCacher {
    protected rvk: RVKWrapper;
    constructor(rvk: RVKWrapper);
    protected getTxs(count?: number, before?: number | undefined, batchSize?: number): Promise<(ElusivTransaction | undefined)[]>;
    protected static getTxsInNonceRange(txs: (ElusivTransaction | undefined)[], count?: number): ElusivTransaction[];
    private static prepareTxFetchingParams;
    private fetchTxsIntoCache;
    private getLatestCachedTx;
    private static getDefaultBefore;
    private static getDefaultAfter;
    private getCachedTxsWrapper;
    private isCachedNonce;
    protected getAndCacheNextTxBatch(batchSize: number, before: number, after: number): Promise<ElusivTransaction[]>;
    private fetchAndCacheTxsInRange;
    private fetchTxsInRange;
    private getLatestCachedNonce;
    private getLatestTransactionsIntoCache;
    protected abstract getTxsFromNonces(nonces: Pair<number, boolean>[], rvk: RVKWrapper): Promise<ElusivTransaction[]>;
}

type SigResponse = Pair<ParsedTransactionWithMeta, ConfirmedSignatureInfo>;
type NoncedTxResponse = {
    txResponse: SigResponse[];
    nonce: number;
    idPubKey: PublicKey;
};
declare abstract class IdentifierTxFetcher extends AbstractTxManager {
    private connection;
    protected cluster: Cluster;
    constructor(connection: Connection, cluster: Cluster, rvk: RVKWrapper);
    protected getTxsFromNonces(nonces: readonly Pair<number, boolean>[]): Promise<ElusivTransaction[]>;
    private getTxSigsForIdKeyFromBlockchain;
    private sigsToElusivTxs;
    private txResponsesToElusivTxs;
    protected txResponseToElusivTx(txRes: NoncedTxResponse): Promise<ElusivTransaction[]>;
}

declare class TransactionManager extends IdentifierTxFetcher {
    static createTxManager(connection: Connection, cluster: Cluster, rvk: RVKWrapper): TransactionManager;
    fetchTxs(count: number, tokenType?: TokenType, before?: number): Promise<ElusivTransaction[]>;
    getPrivateBalance(tokenType: TokenType, before?: number, batchSize?: number): Promise<bigint>;
    getPrivateBalanceFromTxHistory(tokenType: TokenType, before?: number, batchSize?: number): Promise<bigint>;
    getPrivateBalanceFromMetadata(tokenType: TokenType, before?: number, batchSize?: number): Promise<bigint>;
    getMostRecentTx(): Promise<ElusivTransaction | undefined>;
    getActiveTxs(tokenType: TokenType, beforeSend?: SendTx): Promise<ElusivTransaction[]>;
    private static getLowestFetchedNonceFromBatch;
}

declare class SeedWrapper {
    private rvk;
    private readonly generateNullifierClosure;
    private readonly deriveKeyExternalClosure;
    constructor(seed: Uint8Array);
    getRootViewingKeyWrapper(): RVKWrapper;
    deriveKeyExternal(info: string, salt: number, length: number): Uint8Array;
    generateNullifier(nonce: number): Uint8Array;
}

declare class CommitmentManager {
    txManager: TransactionManager;
    treeManager: TreeManager;
    private constructor();
    static createCommitmentManager(treeManager: TreeManager, txManager: TransactionManager): CommitmentManager;
    getIncompleteCommitmentsForTxs(txs: ElusivTransaction[], seedWrapper: SeedWrapper): Promise<{
        commitments: GeneralSet<IncompleteCommitment>;
        startIndices: (number | undefined)[];
    }>;
    getActiveCommitments(tokenType: TokenType, seedWrapper: SeedWrapper, beforeSend?: SendTx): Promise<GeneralSet<Commitment>>;
    static needMerge(activeCommitments: IncompleteCommitment[]): boolean;
    isCommitmentInserted(commitmentHash: ReprScalar, startingIndex?: number): Promise<boolean>;
    isTransactionConfirmed(tx: ElusivTransaction, seedWrapper: SeedWrapper): Promise<boolean>;
    private activateCommitmentsInner;
    activateCommitments(incompleteCommitments: GeneralSet<IncompleteCommitment>, startIndices: (number | undefined)[]): Promise<GeneralSet<Commitment>>;
    getCommitmentForTransaction(tx: ElusivTransaction, seedWrapper: SeedWrapper): Promise<IncompleteCommitment>;
    awaitCommitmentInsertion(commitmentHash: ReprScalar, startingIndex?: number, delayBetweenFetches?: number, timeout?: number): Promise<boolean>;
    private getCommitmentForPartialSend;
    private static buildCommitmentForPartialSend;
    static buildCommitmentForSend(nullifier: Uint8Array, tokenType: TokenType, privateBalanceBeforeNonce: bigint, sendAmount: bigint, totalFee: bigint, assocCommIndex: number): IncompleteCommitment;
    static buildCommitmentForPartialStore(partialStoreTx: PartialStoreTx, seedWrapper: SeedWrapper): IncompleteCommitment;
    private static normalizeStartIndices;
    private static commFromMetadata;
}

declare class ElusivViewer {
    protected readonly cluster: Cluster;
    protected connection: Connection;
    protected txManager: TransactionManager;
    protected commManager: CommitmentManager;
    protected constructor(cluster: Cluster, connection: Connection, txManager: TransactionManager, commManager: CommitmentManager);
    static getElusivViewerInstance(rootViewingKey: string, connection: Connection, cluster: Cluster): Promise<ElusivViewer>;
    getPrivateTransactions(count: number, tokenType?: TokenType): Promise<PrivateTxWrapper[]>;
    getLatestPrivateBalance(tokenType: TokenType): Promise<bigint>;
    static getCurrentPoolSize(cluster: Cluster, conn: Connection, tokenType: TokenType): Promise<number>;
    static estimateTxsCountLastTime(cluster: Cluster, conn: Connection, timeSec: number, tokenType?: TokenType, msBetweenBatches?: number): Promise<number>;
    static getTxsCountLastTime(cluster: Cluster, conn: Connection, timeSec: number, tokenType?: TokenType, msBetweenBatches?: number): Promise<number>;
    static getVolumeLastTime(cluster: Cluster, conn: Connection, timeSec: number, tokenType: TokenType, msBetweenBatches?: number): Promise<number>;
    private static getElusivSigsLastTime;
}

declare class Elusiv extends ElusivViewer {
    private feeCalculatorCached?;
    private tokenAccRentCached?;
    private ownerKey;
    private feeManager;
    private treeManager;
    private txSender;
    private seedWrapper;
    private constructor();
    static getElusivInstance(seed: Uint8Array, owner: PublicKey, connection: Connection, cluster: Cluster): Promise<Elusiv>;
    buildTopUpTx(amount: number, tokenType: TokenType, manualMerge?: boolean, wardenInfo?: WardenInfo, sender?: PublicKey): Promise<TopupTxData>;
    buildWithdrawTx(tokenType: TokenType, extraFee?: OptionalFee, allowOwnerOffCurve?: boolean, wardenInfo?: WardenInfo): Promise<SendTxData>;
    buildSendTx(amount: number, recipient: PublicKey, tokenType: TokenType, refKey?: PublicKey, memo?: string, extraFee?: OptionalFee, isSolanaPayTransfer?: boolean, allowOwnerOffCurve?: boolean, customRecipientTA?: PublicKey | undefined, customFeeCollectorTA?: PublicKey | undefined, wardenInfo?: WardenInfo): Promise<SendTxData>;
    sendElusivTx(txData: ElusivTxData): Promise<ConfirmedSignatureInfo>;
    sendElusivTxWithTracking(txData: ElusivTxData): Promise<{
        elusivTxSig: ConfirmedSignatureInfo;
        commitmentInsertionPromise: Promise<boolean>;
    }>;
    getViewingKey(sendTx: PrivateTxWrapper): ViewingKey;
    getRootViewingKey(): string;
    estimateTopupFee(feeCalcInfo: TopupFeeCalcInfo): Promise<Fee>;
    estimateTopupFeesBatch(feeCalcInfos: TopupFeeCalcInfo[]): Promise<Fee[]>;
    estimateSendFee(feeCalcInfo: SendFeeCalcInfo, allowOwnerOffCurve?: boolean): Promise<Fee>;
    estimateSendFeesBatch(feeCalcInfos: SendFeeCalcInfo[], allowOwnerOffCurve?: boolean): Promise<Fee[]>;
    deriveKeyExternal(info: string, salt: number, length: number): Uint8Array;
    private estimateSendFeeInternal;
    private estimateTopupFeeInternal;
    private getTokenPriceMap;
    private findSig;
}

type TokenInfo = {
    symbol: TokenType;
    mintMainnet: PublicKey;
    mintDevnet: PublicKey;
    active: boolean;
    decimals: number;
    min: number;
    max: number;
    denomination: number;
    pythUSDPriceMainnet: PublicKey;
    pythUSDPriceDevnet: PublicKey;
};
declare function getTokenInfo(tokenType: TokenType): TokenInfo;
declare function getMintAccount(tokenType: TokenType, cluster: Cluster): PublicKey;
declare function airdropToken(tokenType: TokenType, amount: number, recipientTA: PublicKey, cluster?: Cluster, wardenInfo?: WardenInfo): Promise<ConfirmedSignatureInfo>;

declare const SEED_MESSAGE = "Sign this message to generate the Elusiv seed. This allows the application to decrypt your private assets so you can spend them privately.\n\nIMPORTANT: Only sign this message if you trust this application.";

export { SharedTxData as BaseTxData, BasicFee, Elusiv, ElusivTxData, ElusivViewer, Fee, FeeCalcInfo, OptionalFee, PrivateTxWrapper, PrivateTxWrapperShared, SEED_MESSAGE, SendFeeCalcInfo, SendTxData, SendTxWrapper, TokenInfo, TokenType, TokenTypeArr, TopUpTxWrapper, TopupFeeCalcInfo, TopupTxData, TransactionStatus, TxTypes, ViewingKey, WardenInfo, airdropToken, getComputationFeeTotal, getMintAccount, getSendTxWithViewingKey, getTokenInfo, getTotalFeeAmount };
