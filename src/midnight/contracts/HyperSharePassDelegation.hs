{-|
  HyperSharePass Delegation Smart Contract
  Policy ID: a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46
  
  This contract tracks delegation of HyperSharePass NFTs to HyperCycle node factories
  and enables NFT-gated access to MosAic AI agent services.

  Author: HPEC DAO
  Version: 1.0.0
-}

{-# LANGUAGE DataKinds #-}
{-# LANGUAGE FlexibleContexts #-}
{-# LANGUAGE MultiParamTypeClasses #-}
{-# LANGUAGE NoMonoLocalBinds #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE ScopedTypeVariables #-}
{-# LANGUAGE TypeFamilies #-}

module HyperSharePassDelegation where

import PlutusTx
import PlutusTx.Prelude
import PlutusLedgerApi.V1 (Credential(..), PubKeyHash(..), ScriptContext(..), TxInfo(..), TxInInfo(..))
import PlutusLedgerApi.V1.Value
import PlutusLedgerApi.V2
import Prelude (Semigroup(..))

-- | HyperSharePass Policy ID
hyperSharePassPolicyId :: TokenName
hyperSharePassPolicyId = "a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46"

-- | NFT Name prefixes
nftPrefix :: TokenName
nftPrefix = "HyperSharePassHolder"

-- | Data Types

-- | Delegation state for a holder
data DelegationState = DelegationState
    { holderAddress   :: PubKeyHash     -- Cardano address of the holder
    , nodeFactoryIds  :: [Integer]       -- List of node factory IDs delegated
    , anfeIds         :: [Integer]       -- List of ANFE IDs (from Base)
    , delegateWeight  :: Integer         -- Total delegation weight
    , lastUpdated     :: Integer          -- Slot number of last update
    } deriving (Show, Generic, FromJSON, ToJSON)

-- | Action that can be performed on the contract
data DelegationAction
    = Delegate NodeFactoryId Integer  -- Delegate to node factory with weight
    | Undelegate NodeFactoryId        -- Remove delegation
    | UpdateWeight Integer            -- Update total weight
    | TransferDelegation PubKeyHash   -- Transfer delegation rights
    deriving (Show, Generic, FromJSON, ToJSON)

-- | Node factory identifier
newtype NodeFactoryId = NodeFactoryId Integer
    deriving (Show, Eq, Ord)

-- | Custom error types
data DelegationError
    = NotEnoughNFTs
    | InvalidNodeFactory
    | Unauthorized
    | AlreadyDelegated
    | NotDelegated
    deriving (Show, Eq)

-- | Constants
maxNodeFactoriesPerHolder :: Integer
maxNodeFactoriesPerHolder = 100

minDelegationWeight :: Integer
minDelegationWeight = 1

-- | Validator Script

-- | Check if the transaction is valid for delegation
mkDelegationValidator :: DelegationState -> DelegationAction -> ScriptContext -> Bool
mkDelegationValidator state action ctx =
    traceIfFalse "Not authorized" isAuthorized
    && traceIfFalse "Invalid action" (validateAction action)
    && traceIfFalse "NFT required" hasRequiredNFT
  where
    info :: TxInfo
    info = scriptContextTxInfo ctx
    
    -- Get the signing key hash (who's calling the contract)
    isAuthorized :: Bool
    isAuthorized = case txInfoSignatories info of
        [sig] -> sig == holderAddress state
        _     -> False
    
    -- Validate the specific action
    validateAction :: DelegationAction -> Bool
    validateAction (Delegate nfid weight) =
        weight >= minDelegationWeight
        && length (nodeFactoryIds state) < maxNodeFactoriesPerHolder
    
    validateAction (Undelegate nfid) =
        traceIfFalse "Not delegated to this node factory" $
        traceIfFalse "No delegations to remove" $
            not $ null (nodeFactoryIds state)
    
    validateAction (UpdateWeight newWeight) =
        newWeight >= minDelegationWeight
    
    validateAction (TransferDelegation newHolder) =
        traceIfFalse "Cannot transfer to zero address" $
            newHolder /= PubKeyHash emptyByteString
    
    -- Check that user has at least one HyperSharePass NFT
    hasRequiredNFT :: Bool
    hasRequiredNFT = 
        let value = txInfoMint info
            hasNFT = assetClassValueOf value (AssetClass (toBuiltin hyperSharePassPolicyId, nftPrefix)) > 0
            -- Also check in inputs (for non-minting transactions)
            inputNFTs = mconcat [ valueOf (txOutValue $ txInInfoResolved input) (toBuiltin hyperSharePassPolicyId) nftPrefix 
                                | input <- txInfoInputs info 
                                ]
        in hasNFT || inputNFTs > 0

-- | Compile the validator
{-# INLINABLE mkWrappedValidator #-}
mkWrappedValidator :: BuiltinData -> BuiltinData -> BuiltinData -> ()
mkWrappedValidator datums redeemer ctx =
    check $ 
        let state = unsafeFromBuiltinData datums
            action = unsafeFromBuiltinData redeemer
            context = unsafeFromBuiltinData ctx
        in mkDelegationValidator state action context

validator :: Validator
validator = Validator $ 
    $$(PlutusTx.compile [|| mkWrappedValidator ||])

-- | Helper Functions

-- | Calculate delegation weight based on NFTs held
calculateDelegationWeight :: Integer -> Integer
calculateDelegationWeight nftCount =
    -- Each NFT = 1 base weight + bonus for bulk holdings
    nftCount + bulkBonus nftCount
  where
    bulkBonus :: Integer -> Integer
    bulkBonus n
        | n >= 100 = n `divide` 10  -- 10% bonus for 100+
        | n >= 50  = n `divide` 20  -- 5% bonus for 50+
        | n >= 10  = n `divide` 50  -- 2% bonus for 10+
        | otherwise = 0

-- | Get node factory capacity based on delegation
getNodeFactoryCapacity :: DelegationState -> Integer
getNodeFactoryCapacity state =
    let totalWeight = delegateWeight state
    in totalWeight * 10  -- Each weight unit supports 10 node factories

-- | Check if a holder can create an AI agent
canCreateAgent :: DelegationState -> Bool
canCreateAgent state = 
    delegateWeight state >= 1  -- Need at least 1 weight to create agent

-- | Check access level based on delegation
getAccessLevel :: DelegationState -> AccessLevel
getAccessLevel state
    | delegateWeight state >= 100 = Level3  -- Full access
    | delegateWeight state >= 50  = Level2  -- Standard access
    | delegateWeight state >= 10  = Level1  -- Basic access
    | otherwise                   = Level0  -- No access
  where
    data AccessLevel = Level0 | Level1 | Level2 | Level3

-- | Off-Chain Helpers (for wallet integration)

-- | Build delegation datum for UTxO
buildDelegationDatum :: PubKeyHash -> [NodeFactoryId] -> [Integer] -> Integer -> Integer -> DelegationState
buildDelegationDatum holder nodes anfes weight slot =
    DelegationState
        { holderAddress = holder
        , nodeFactoryIds = map (\(NodeFactoryId i) -> i) nodes
        , anfeIds = anfes
        , delegateWeight = weight
        , lastUpdated = slot
        }

-- | Serialize state to JSON (for API)
delegationToJson :: DelegationState -> ByteString
delegationToJson state = 
    -- Use ToJSON instance
    unsafeFromBuiltinData $ toBuiltin $ encodeJson state

-- | Script Address
scriptAddress :: Address
scriptAddress = validatorHashAddress $ scriptHash validator

-- | Extract policy ID from token name
extractPolicyId :: TokenName -> Maybe PolicyId
extractPolicyId (TokenName tn) =
    if tn == toBuiltin hyperSharePassPolicyId
    then Just $ PolicyId $ toBuiltin hyperSharePassPolicyId
    else Nothing

-- | Validate NFT format
isValidHyperSharePass :: TokenName -> Bool
isValidHyperSharePass tn =
    let tnBytes = fromBuiltin tn
    in  isPrefixOf "HyperSharePassHolder" (decodeUtf8 tnBytes)