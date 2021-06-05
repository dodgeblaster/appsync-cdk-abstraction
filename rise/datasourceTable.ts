import * as cdk from '@aws-cdk/core'
import * as appsync from '@aws-cdk/aws-appsync'
import * as iam from '@aws-cdk/aws-iam'

export class DbDatasource extends cdk.Construct {
    ds: any
    constructor(
        scope: cdk.Construct,
        id: string,
        props: {
            tableName: string
            apiId: string
            region: string
        }
    ) {
        super(scope, id)
        const itemsTableRole = new iam.Role(this, 'DynamoDBRole', {
            assumedBy: new iam.ServicePrincipal('appsync.amazonaws.com')
        })

        itemsTableRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName(
                'AmazonDynamoDBFullAccess'
            )
        )

        const tableDataSource = new appsync.CfnDataSource(
            this,
            'tableDatasource',
            {
                apiId: props.apiId,
                name: 'DynamoDataSource',
                type: 'AMAZON_DYNAMODB',
                dynamoDbConfig: {
                    tableName: props.tableName,
                    awsRegion: props.region
                },
                serviceRoleArn: itemsTableRole.roleArn
            }
        )

        this.ds = tableDataSource
    }

    public get() {
        return this.ds
    }
}
