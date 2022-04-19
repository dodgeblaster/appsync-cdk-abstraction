import * as cdk from '@aws-cdk/core'
import * as lambda from '@aws-cdk/aws-lambda'
import * as iam from '@aws-cdk/aws-iam'
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks'
import events = require('@aws-cdk/aws-events')
import * as sfn from '@aws-cdk/aws-stepfunctions'

export class EventToQueryResources extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string) {
        super(scope, id)
    }

    setupResources(props: { apiArn: string }) {
        const callGrapQLLambda = new lambda.Function(
            this,
            'callGraphQLLambda',
            {
                runtime: lambda.Runtime.NODEJS_12_X,
                code: lambda.Code.fromAsset('rise/functions/callGraphQL'),
                handler: 'index.handler',
                environment: {}
            }
        )

        callGrapQLLambda.addToRolePolicy(
            new iam.PolicyStatement({
                resources: [props.apiArn],
                actions: ['appsync:GraphQL']
            })
        )

        const callGraphQL = new tasks.LambdaInvoke(this, 'eventToGraphQLTask', {
            lambdaFunction: callGrapQLLambda,
            inputPath: '$.graphQL'
        })

        return callGraphQL
    }

    makeEventToQueryConnection(props: {
        bus: string
        source: string
        detailType: string
        field: string
        callGrapQLLambda: any
        region: string
    }) {
        // const stepDefine = new sfn.Pass(
        //     this,
        //     `${props.field}eventSubStepDefine`,
        //     {
        //         comment: 'Define Query',
        //         resultPath: '$.graphQL',
        //         result: sfn.Result.fromObject({
        //             query: {
        //                 query: `mutation($input: TestingInput) {
        //             testing(input: $input)
        //         }`,
        //                 variables: {
        //                     input: {
        //                         id: 'something'
        //                     }
        //                 }
        //             }
        //         })
        //     }
        // )
        // const callGraphQL = new tasks.LambdaInvoke(
        //     this,
        //     `${props.field}callGraphQLTask`,
        //     {
        //         lambdaFunction: props.callGrapQLLambda,
        //         inputPath: '$.graphQL'
        //     }
        // )
        // const definitionChain = sfn.Chain.start(stepDefine).next(callGraphQL)
        // const stepfunction = new sfn.StateMachine(
        //     this,
        //     `${props.field}eventSubStepFunction`,
        //     {
        //         timeout: cdk.Duration.minutes(5),
        //         stateMachineName: `${props.field}eventSubStepFunction`,
        //         definition: definitionChain
        //     }
        // )
        const stepRole = new iam.CfnRole(
            this,
            `${props.field}eventSubStepRole`,
            {
                assumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: {
                        Effect: 'Allow',
                        Principal: {
                            Service: `states.${props.region}.amazonaws.com`
                        },
                        Action: 'sts:AssumeRole'
                    }
                },

                policies: [
                    {
                        policyName: `${props.field}eventSubStepPolicy`,
                        policyDocument: {
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Effect: 'Allow',
                                    Resource: ['*'],
                                    Action: ['lambda:InvokeFunction']
                                }
                            ]
                        }
                    }
                ]
            }
        )

        const stepResource = new cdk.CfnResource(this, 'stepresource', {
            type: 'AWS::StepFunctions::StateMachine',
            properties: {
                StateMachineName: 'ProductUpdatedWorkflow',
                RoleArn: stepRole.attrArn,
                DefinitionString: `{
                    "Comment": "Handles Call GraphQL Workflow",
                    "StartAt": "Define",
                    "States": {
                        "Define": {
                            "Type": "Pass",
                            "ResultPath": "$.graphQL",
                            "Result": {
                                "query": "example"
                            },
                            "Next": "CallGraphQL"
                        },
                        "CallGraphQL": {
                            "Type": "Task",
                            "Resource": "arn:aws:states:::lambda:invoke",
                            "Parameters": {
                                "FunctionName": "${props.callGrapQLLambda.functionName}",
                                "Payload": {
                                "PK": {"S.$": "$.detail.PK"}
                                }
                            },
                            "End": true
                        }
                    }
                }`
            }
        })

        const ruleInvokeRole = new iam.CfnRole(
            this,
            `${props.field}eventSubRuleInvokeRole`,
            {
                assumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: {
                        Effect: 'Allow',
                        Principal: {
                            Service: 'events.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }
                },

                policies: [
                    {
                        policyName: `${props.field}eventSubRuleTargetPolicy`,
                        policyDocument: {
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Effect: 'Allow',
                                    Resource: [stepResource.ref],
                                    Action: ['states:StartExecution']
                                }
                            ]
                        }
                    }
                ]
            }
        )

        // const rulee = new events.CfnRule(this, `${props.field}eventSubRule`, {
        //     eventBusName: props.bus,
        //     state: 'ENABLED',
        //     eventPattern: {
        //         source: [props.source],
        //         detailType: [props.detailType]
        //     },
        //     targets: [
        //         {
        //             arn: stepfunction.stateMachineArn,
        //             id: `${props.field}eventSubRuleTargetId`,
        //             roleArn: ruleInvokeRole.attrArn
        //         }
        //     ]
        // })

        const MyResource = new cdk.CfnResource(this, 'MyResource', {
            type: 'AWS::Events::Rule',
            properties: {
                EventBusName: props.bus,
                EventPattern: {
                    source: [props.source],
                    'detail-type': [props.detailType]
                },
                Targets: [
                    {
                        Arn: stepResource.ref,
                        Id: `${props.field}eventSubRuleTargetId`,
                        RoleArn: ruleInvokeRole.attrArn
                    }
                ]
            }
        })
    }
}
