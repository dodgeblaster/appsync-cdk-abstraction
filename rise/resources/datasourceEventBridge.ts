import * as cdk from '@aws-cdk/core'
import * as appsync from '@aws-cdk/aws-appsync'
import * as iam from '@aws-cdk/aws-iam'

export class EventDatasource extends cdk.Construct {
    ds: any
    constructor(
        scope: cdk.Construct,
        id: string,
        props: {
            apiId: string
            region: string
        }
    ) {
        super(scope, id)
        const appsyncEventBridgeRole = new iam.Role(
            this,
            'AppSyncEventBridgeRole',
            {
                assumedBy: new iam.ServicePrincipal('appsync.amazonaws.com')
            }
        )

        appsyncEventBridgeRole.addToPolicy(
            new iam.PolicyStatement({
                resources: ['*'],
                actions: ['events:Put*']
            })
        )
        const dataSource = new appsync.CfnDataSource(
            this,
            'EventBridgeDataSource',
            {
                apiId: props.apiId,
                name: 'EventBridgeDataSource',
                type: 'HTTP',
                httpConfig: {
                    authorizationConfig: {
                        authorizationType: 'AWS_IAM',
                        awsIamConfig: {
                            signingRegion: props.region,
                            signingServiceName: 'events'
                        }
                    },
                    endpoint:
                        'https://events.' + props.region + '.amazonaws.com/'
                },
                serviceRoleArn: appsyncEventBridgeRole.roleArn
            }
        )

        this.ds = dataSource
    }

    public get() {
        return this.ds
    }
}
