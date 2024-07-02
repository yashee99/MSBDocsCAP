//using { cuid ;Currency ; managed ; sap } from '@sap/cds/common'; 

namespace remoteSigning; 
entity SignedDocuments {
InvoiceID : String(100);
DocumentName: String(100);
DocumentContent: LargeBinary;
}

entity EmbeddedSigningInitiated {
InvoiceID : String(100);
DocumentName: String(100);

ReferenceNumber: String;
DocumentNumber:Integer;
Status:String;
}
@cds.persistence.skip : true
entity RemoteSign { 
    InvoiceID : String(100);
    DocumentName: String(100);
    FileData: String;
    SignedDocument: String;
    StatusText:String;
    ReferenceNumber:String;

} 
@cds.persistence.skip : true
entity EmbeddedSign {
    InvoiceID : String(100);
    DocumentName: String(100);
    FileData: String;
    StatusText:String;
    ReferenceNumber:String;
    URL:String;
    DocumentNumber:Integer;
}

@cds.persistence.skip : true
entity SignedEmbeddedDocument {
    InvoiceID : String(100);
    DocumentContent: LargeBinary;
}

@cds.persistence.skip : true
entity BillingDocumentVH {
 key BillingDocument : String(10);
}
@cds.persistence.skip : true
entity BillingTypeVH {
 key BillingDocumentType : String(4);
}
@cds.persistence.skip : true
entity BillingStatusVH {
 key OverAllBillingStatus : String(1);
}

@cds.persistence.skip : true
entity SoldToPartyVH {
 key SoldToParty : String(10);
}


