const cds = require('@sap/cds');
const Handler = require('./handlers/handler');
const { executeHttpRequest } = require('@sap-cloud-sdk/core');
const envtype = process.env.TYPE;
function base64UrlToBase64(base64Url) {
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return base64;
}

module.exports = function () {
    this.on("CREATE", "RemoteSign", async req => {

        const sToken = await Handler.getToken(req);
        const oSignedResponse = await Handler.sendSignedData(req, sToken);
        try {
            if (!oSignedResponse.data) {
                req.reject(400, oSignedResponse.Response);
                return;
            }
            const db = await cds.connect.to('db');
            const tx = db.transaction();
            const { SignedDocuments } = this.entities;
            // await db.run(DELETE.from(SignedDocuments));
            await tx.run(INSERT.into(SignedDocuments).entries({
                InvoiceID: req.data.InvoiceID,
                DocumentName: req.data.DocumentName,
                DocumentContent: oSignedResponse.data.Response.SignedDocument[0]
            }));
            await tx.commit();


            return {
                SignedDocument: oSignedResponse.data.Response.SignedDocument[0],
                StatusText: oSignedResponse.status,
                ReferenceNumber: oSignedResponse.data.Response.DocumentNumberList[0]
            };
        } catch (error) {
            req.reject(400, error)
        }
    });
    this.on("CREATE", "EmbeddedSign", async req => {

        const sToken = await Handler.getToken(req);
        const oSignedResponse = await Handler.embeddedSigning(req, sToken);

        //Inset into hana db
        const db = await cds.connect.to('db');
        const tx = db.transaction();
        const { EmbeddedSigningInitiated } = this.entities;
        // await db.run(DELETE.from(SignedDocuments));
        await tx.run(INSERT.into(EmbeddedSigningInitiated).entries({
            InvoiceID: req.data.InvoiceID,
            DocumentName: req.data.DocumentName,
            ReferenceNumber: oSignedResponse.ReferenceNo,
            DocumentNumber: oSignedResponse.data.Response.DocumentIdList[0],
            Status: ""
        }));
        await tx.commit();
        return {
            URL: oSignedResponse.data.Response.URL,
            StatusText: oSignedResponse.status,
            DocumentNumber: oSignedResponse.data.Response.DocumentIdList[0]
        };
    });
    // read Billing documents for remote signing
    this.on("READ", "A_BillingDocument", async req => {

        try {
            const srv = await cds.connect.to('S4Hana_Cloud');
            let bDocumentSignedFlag;

            let aQuery = { ...req.query };
            let oLimit;

            if (aQuery.SELECT.where && aQuery.SELECT.where.length > 0) {
                var index = aQuery.SELECT.where.findIndex(function (element) {
                    if (element.ref && element.ref.length > 0)
                        return element.ref[0] === "isDocumentSigned";
                });
                if (index !== -1) {
                    bDocumentSignedFlag = aQuery.SELECT.where[index + 2].val;
                    // aQuery.SELECT.where.splice(index,3);
                    // if(aQuery.SELECT.where.length===0){
                    //     delete  aQuery.SELECT.where
                    // }
                }
                oLimit = { ...aQuery.SELECT.limit };
                // delete aQuery.SELECT.limit;

            }
            let sQuery = decodeURIComponent(req.getUrlObject().path).replace("/$count", "");
            sQuery = await Handler.appendDateInputs(sQuery);
            sQuery = sQuery.replace("and isDocumentSigned eq false", "");
            sQuery = sQuery.replace("and isDocumentSigned eq true", "");

            if (oLimit?.offset) {
                const sSkipQuery = `$skip=${oLimit.offset.val}`;
                sQuery = sQuery.replace(sSkipQuery, "");
            }
            if (oLimit?.rows) {
                const sTopQuery = `$top=${oLimit.rows.val}`;
                sQuery = sQuery.replace(sTopQuery, "");
            }

            sQuery = sQuery.replace("/EMudhra", "");
            if (!sQuery.split("$filter=")[1]) {
                sQuery = sQuery.replace("?$filter=", "");
            }
            const { SignedDocuments } = this.entities;
            // let aBillingDocuments = await srv.transaction(req).send({
            //     query: aQuery,
            // });
            sQuery = sQuery.trim();
            sQuery = "API_BILLING_DOCUMENT_SRV/" + sQuery
            let aBillingDocuments = await srv.send("GET", sQuery);
            const aBillingDocumentsNumbers = aBillingDocuments.map(oItem => oItem.BillingDocument);
            let aSignedDocuments = [];
            if (aBillingDocumentsNumbers.length > 0) {
                aSignedDocuments = await SELECT.from(SignedDocuments)
                    .columns(['InvoiceID'])
                    .where({
                        INVOICEID: { in: aBillingDocumentsNumbers }
                    });
            }
            const aSignedDocumentIds = aSignedDocuments.map(doc => doc.InvoiceID);
            aBillingDocuments.forEach(doc => {
                if (aSignedDocumentIds.includes(doc.BillingDocument)) {
                    doc.isDocumentSigned = true;
                } else {
                    doc.isDocumentSigned = false;
                }
            });

            // Filter data based on is document signed query
            if (bDocumentSignedFlag !== undefined) {
                aBillingDocuments = aBillingDocuments.filter(function (element) {
                    return element.isDocumentSigned === bDocumentSignedFlag
                });
            }
            //Skip and top filter
            if (oLimit?.offset) {
                aBillingDocuments = aBillingDocuments.slice(oLimit.offset.val, oLimit.offset.val + oLimit.rows.val);
            }
            //Handle $count requests
            if (req.getUrlObject().path.includes("$count")) {
                let result = [];
                result.push({ $count: aBillingDocuments.length })
                return result;

            }
            return aBillingDocuments;
        } catch (error) {
            req.reject(400, error)
        }

    });
    this.on("READ", "A_BillingDocumentEmbedded", async req => {

        try {
            const sToken = await Handler.getToken(req);
            const srv = await cds.connect.to('S4Hana_Cloud');
            let aQuery = { ...req.query };
            let oLimit;
            let bDocumentSignedFlag;

            if (aQuery.SELECT.where && aQuery.SELECT.where.length > 0) {
                var index = aQuery.SELECT.where.findIndex(function (element) {
                    if (element.ref && element.ref.length > 0)
                        return element.ref[0] === "isSigningInitiated";
                });
                if (index !== -1) {
                    bDocumentSignedFlag = aQuery.SELECT.where[index + 2].val;

                }
                oLimit = { ...aQuery.SELECT.limit };


            }
            let sQuery = decodeURIComponent(req.getUrlObject().path).replace("/$count", "");
            sQuery = await Handler.appendDateInputs(sQuery);
            sQuery = sQuery.replace("and isSigningInitiated eq false", "");
            sQuery = sQuery.replace("and isSigningInitiated eq true", "");

            if (oLimit?.offset) {
                const sSkipQuery = `$skip=${oLimit.offset.val}`;
                sQuery = sQuery.replace(sSkipQuery, "");
            }
            if (oLimit?.rows) {
                const sTopQuery = `$top=${oLimit.rows.val}`;
                sQuery = sQuery.replace(sTopQuery, "");
            }

            sQuery = sQuery.replace("/EMudhra", "");
            if (!sQuery.split("$filter=")[1]) {
                sQuery = sQuery.replace("?$filter=", "");
            }


            sQuery = sQuery.replaceAll("A_BillingDocumentEmbedded", "A_BillingDocument");
            sQuery = sQuery.trim();
            sQuery = "API_BILLING_DOCUMENT_SRV/" + sQuery
            let aBillingDocuments = await srv.send("GET", sQuery);

            const { EmbeddedSigningInitiated } = this.entities;
            // New Code
            const aBillingDocumentsNumbers = aBillingDocuments.map(oItem => oItem.BillingDocument);
            let aSignedDocuments = [];
            if (aBillingDocumentsNumbers.length > 0) {
                aSignedDocuments = await SELECT.from(EmbeddedSigningInitiated)
                    .where({
                        INVOICEID: { in: aBillingDocumentsNumbers }
                    });
            }


            if (!req.getUrlObject().path.includes("$count")) {
                for (let i = 0; i < aBillingDocuments.length; i++) {

                    const result = aSignedDocuments.filter(function (element) {
                        return element.InvoiceID === aBillingDocuments[i].BillingDocument
                    });
                    aBillingDocuments[i].isSigningInitiated = false;
                    aBillingDocuments[i].SigningStatus = "";
                    if (result.length > 0) {
                        aBillingDocuments[i].isSigningInitiated = true;
                        if (!result[result.length - 1].Status) {
                            const sStatus = await Handler.getDocStatus(result[result.length - 1], sToken);
                            aBillingDocuments[i].SigningStatus = sStatus;
                            if (sStatus) {
                                //update DB
                                Handler.UpdateEmbeddedSigningStatus(EmbeddedSigningInitiated, sStatus, aBillingDocuments[i].BillingDocument);
                            }

                        }
                        else {
                            aBillingDocuments[i].SigningStatus = result[result.length - 1].Status;
                        }
                    }
                }
            }
            // Filter data based on is document signed query
            if (bDocumentSignedFlag !== undefined) {
                aBillingDocuments = aBillingDocuments.filter(function (element) {
                    return element.isSigningInitiated === bDocumentSignedFlag
                });
            }
            //Skip and top filter
            if (oLimit?.offset) {
                aBillingDocuments = aBillingDocuments.slice(oLimit.offset.val, oLimit.offset.val + oLimit.rows.val);
            }
            //Handle $count requests
            if (req.getUrlObject().path.includes("$count")) {
                let result = [];
                result.push({ $count: aBillingDocuments.length })
                return result;

            }
            return aBillingDocuments;


        } catch (error) {
            req.reject(400, error)
        }

    });



    this.on("GetPDF", async req => {

        try {
            const sUrl = `/sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV/GetPDF?BillingDocument='${req.data.BillingDocument}'`
            const users = await executeHttpRequest(
                { destinationName: 'S4Hana_Cloud' },
                {
                    method: 'get',
                    url: sUrl,
                    params: req.data
                }

            );
            return users.data.d.GetPDF;


        } catch (error) {
            req.reject(400, error)
        }

    });
    this.on("CREATE", "SignedEmbeddedDocument", async req => {
        const { EmbeddedSigningInitiated } = this.entities;
        const result = await SELECT.from(EmbeddedSigningInitiated).where({
            INVOICEID: req.data.InvoiceID
        });

        try {
            const sToken = await Handler.getToken(req);
            const oSignedResponse = await Handler.getEmbeddedDocument(result[result.length - 1].ReferenceNumber, sToken);


            return {
                InvoiceID: req.data.InvoiceID,
                DocumentContent: oSignedResponse
            };
        } catch (error) {
            req.reject(400, error)
        }
    });
    this.on("GET", "BillingDocumentVH", async req => {
        const srv = await cds.connect.to('S4Hana_Cloud');
        let sQuery = decodeURIComponent(req.getUrlObject().path);
        sQuery = sQuery.replace("BillingDocumentVH", "YY1_EMDR_BILL_DOC_F4_CDS/YY1_EMDR_BILL_DOC_F4");
        try {
            let aBillingDocuments = await srv.send("GET", sQuery);

            return aBillingDocuments;
        } catch (error) {
            req.reject(400, error)
        }

    });
    this.on("GET", "BillingTypeVH", async req => {
        const srv = await cds.connect.to('S4Hana_Cloud');
        let sQuery = decodeURIComponent(req.getUrlObject().path);

        sQuery = sQuery.replace("BillingTypeVH", "YY1_EMDR_BILL_TYPE_F4_CDS/YY1_EMDR_BILL_TYPE_F4");
        try {
            let aBillingDocumentType = await srv.send("GET", sQuery);

            return aBillingDocumentType;
        } catch (error) {
            req.reject(400, error)
        }

    });
    this.on("GET", "BillingStatusVH", async req => {
        const srv = await cds.connect.to('S4Hana_Cloud');

        try {
            let sQuery = decodeURIComponent(req.getUrlObject().path);
            sQuery = sQuery.replace("BillingStatusVH", "YY1_EMDR_BILL_STS_F4_CDS/YY1_EMDR_BILL_STS_F4");

            let aBillingStatusType = await srv.send("GET", sQuery);
            if (!Array.isArray(aBillingStatusType)) {
                return aBillingStatusType;
            }

            let aBillingStatus = [];
            aBillingStatusType.forEach(function (oBillingStatus) {
                aBillingStatus.push({
                    OverAllBillingStatus: oBillingStatus.BillgDocReqBillgSts
                })
            })


            return aBillingStatus;
        } catch (error) {
            req.reject(400, error)
        }

    });

    //Sold to Party value help services
    this.on("GET", "SoldToPartyVH", async req => {
        const srv = await cds.connect.to('S4Hana_Cloud');
        let sQuery = decodeURIComponent(req.getUrlObject().path);

        sQuery = sQuery.replace("SoldToPartyVH", "YY1_EMDR_SOLD_TO_PARTY_F4_CDS/YY1_EMDR_SOLD_TO_PARTY_F4");
        try {
            let aSoldToParty = await srv.send("GET", sQuery);
            if (!Array.isArray(aSoldToParty)) {
                return aSoldToParty;
            }
            const aFinalData = aSoldToParty.map(function (oSoldToParty) {
                return {
                    SoldToParty: oSoldToParty.Customer
                }
            });

            return aFinalData;
        } catch (error) {
            req.reject(400, error)
        }

    });





}