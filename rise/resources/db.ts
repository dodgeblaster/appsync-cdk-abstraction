import * as cdk from '@aws-cdk/core'
import * as db from '@aws-cdk/aws-dynamodb'

export class RiseDb extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: { name: string }) {
        super(scope, id)
        const table = new db.Table(this, 'main-db', {
            tableName: props.name,
            partitionKey: {
                name: `pk`,
                type: db.AttributeType.STRING
            },
            sortKey: {
                name: 'sk',
                type: db.AttributeType.STRING
            },

            billingMode: db.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        })

        table.addGlobalSecondaryIndex({
            indexName: 'gsi1',
            partitionKey: {
                name: `gsi1`,
                type: db.AttributeType.STRING
            },
            sortKey: {
                name: 'sk',
                type: db.AttributeType.STRING
            }
        })

        table.addGlobalSecondaryIndex({
            indexName: 'gsi2',
            partitionKey: {
                name: `gsi2`,
                type: db.AttributeType.STRING
            },
            sortKey: {
                name: 'sk',
                type: db.AttributeType.STRING
            }
        })
    }
}
