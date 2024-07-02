using { remoteSigning as remoteSigning } from '../db/data-model'; 
using { API_BILLING_DOCUMENT as BillingService} from './external/API_BILLING_DOCUMENT.csn';

service CatalogService @(path:'/EMudhra') { 

    entity RemoteSign as projection on remoteSigning.RemoteSign ; 
    entity EmbeddedSign as projection on remoteSigning.EmbeddedSign;
    entity SignedDocuments as projection on remoteSigning.SignedDocuments;
    entity EmbeddedSigningInitiated as projection on remoteSigning.EmbeddedSigningInitiated;
    entity SignedEmbeddedDocument as projection on remoteSigning.SignedEmbeddedDocument;

    entity A_BillingDocument as projection on BillingService.A_BillingDocument{
      *,
      null as isDocumentSigned: Boolean
    };
     entity A_BillingDocumentEmbedded as projection on BillingService.A_BillingDocument{
      *,
      null as isSigningInitiated: Boolean,
      null as SigningStatus: String,
      null as EmbeddedSigningURL: String
    };
    entity BillingDocumentVH as projection on remoteSigning.BillingDocumentVH;
    entity BillingTypeVH as projection on remoteSigning.BillingTypeVH;
    entity BillingStatusVH as projection on remoteSigning.BillingStatusVH;
    entity SoldToPartyVH as projection on remoteSigning.SoldToPartyVH;

    
    
    
    function GetPDF(BillingDocument: String)  returns BillingService.GetPDFResult;
 

}  
// annotate CatalogService.A_BillingDocument with
// @(UI : {
//     SelectionFields : [
//       BillingDocument
//     ],
//     LineItem : [
//         {
//           Value : BillingDocument,
//           Label : '{i18n>columnBillingDocument}'
//         },
//         {
//           Value : TotalNetAmount,
//           Label : '{i18n>columnNetAmount}'
//         },
//         {
//           Value : SoldToParty,
//           Label : '{i18n>columnSoldToParty}'
//         },
        
        
        
//     ]
// });