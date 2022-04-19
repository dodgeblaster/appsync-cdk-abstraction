import * as cdk from '@aws-cdk/core'
import * as appsync from '@aws-cdk/aws-appsync'

type QueryConfig = {
    pk?: string
    sk: string
    pk2?: string
    pk3?: string
}

export class RiseFunction extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string) {
        super(scope, id)
    }

    makeGet(props: {
        schema: appsync.CfnGraphQLSchema
        ds: appsync.CfnDataSource
        apiId: string
        name: string
        //config: QueryConfig
    }) {
        const cfnFunction = new appsync.CfnFunctionConfiguration(
            this,
            `Function${props.name}`,
            {
                apiId: props.apiId,
                name: props.name,
                functionVersion: '2018-05-29',
                dataSourceName: props.ds.name,
                requestMappingTemplate: `{
                  "version": "2017-02-28",
                  "operation": "GetItem",
                  "key": {
                     "pk" : $util.dynamodb.toDynamoDBJson($context.stash.input.pk),
                     "sk" : $util.dynamodb.toDynamoDBJson($context.stash.input.sk)
                  },
                }`,
                responseMappingTemplate: `
                $util.qr($ctx.stash.put("dbresult", $ctx.result))
                $util.toJson($ctx.result.items)`
            }
        )

        cfnFunction.addDependsOn(props.ds)
        cfnFunction.addDependsOn(props.schema)
        return cfnFunction
    }

    makeQuery(props: {
        schema: appsync.CfnGraphQLSchema
        ds: appsync.CfnDataSource
        apiId: string
        name: string
        //config: QueryConfig
    }) {
        const cfnFunction = new appsync.CfnFunctionConfiguration(
            this,
            `Function${props.name}`,
            {
                apiId: props.apiId,
                name: props.name,
                functionVersion: '2018-05-29',
                dataSourceName: props.ds.name,
                requestMappingTemplate: `{
                  "version": "2017-02-28",
                  "operation" : "Query",
                    "query" : {
                        "expression" : "pk = :pk AND begins_with(sk, :sk)",
                        "expressionValues" : {
                            ":pk" : $util.dynamodb.toDynamoDBJson($context.stash.input.pk),
                            ":sk" : $util.dynamodb.toDynamoDBJson($context.stash.input.sk)
                        }
                    }
                }`,
                responseMappingTemplate: `
                $util.qr($ctx.stash.put("dbresult", $ctx.result.items))
                $util.toJson($ctx.result.items)`
            }
        )

        cfnFunction.addDependsOn(props.ds)
        cfnFunction.addDependsOn(props.schema)
        return cfnFunction
    }

    makeGuard(props: {
        schema: appsync.CfnGraphQLSchema
        ds: appsync.CfnDataSource
        apiId: string
        name: string
        config: QueryConfig
    }) {
        let pk = props.config.pk || ''
        if (props.config.pk?.startsWith('$')) {
            pk = pk.replace('$', '$ctx.args.')
        } else {
            pk = `"${pk}"`
        }

        let sk = props.config.sk
        if (props.config.sk?.startsWith('$')) {
            sk = sk.replace('$', '$ctx.args.')
        } else {
            sk = `"${sk}"`
        }

        const cfnFunction = new appsync.CfnFunctionConfiguration(
            this,
            `Function${props.name}`,
            {
                apiId: props.apiId,
                name: props.name,
                functionVersion: '2018-05-29',
                dataSourceName: props.ds.name,
                requestMappingTemplate: `{
                  "version": "2017-02-28",
                  "operation" : "GetItem",
                  "key": {
                    "pk": $util.dynamodb.toDynamoDBJson(${pk}),
                    "sk": $util.dynamodb.toDynamoDBJson(${sk})
                  },
                  "consistentRead": true
                }`,
                responseMappingTemplate: `
                #if(!$ctx.result)
                   $util.error("Unauthorized")
                #else
                    $util.toJson($ctx.result)
                #end    
                `
            }
        )

        cfnFunction.addDependsOn(props.ds)
        cfnFunction.addDependsOn(props.schema)
        return cfnFunction
    }

    makeCreate(props: {
        schema: appsync.CfnGraphQLSchema
        ds: appsync.CfnDataSource
        apiId: string
        name: string
    }) {
        const cfnFunction = new appsync.CfnFunctionConfiguration(
            this,
            `Function${props.name}`,
            {
                apiId: props.apiId,
                name: props.name,
                functionVersion: '2018-05-29',
                dataSourceName: props.ds.name,
                requestMappingTemplate: `{
                  "version": "2017-02-28",
                  "operation": "PutItem",
                  "key": {
                    "pk": $util.dynamodb.toDynamoDBJson($context.stash.input.pk),
                    "sk": $util.dynamodb.toDynamoDBJson($context.stash.input.sk)
                  },
                  "attributeValues": $util.dynamodb.toMapValuesJson($context.stash.input)
                }`,
                responseMappingTemplate: `
                $util.qr($ctx.stash.put("dbresult", $ctx.result))
                $util.toJson($ctx.result)
                `
            }
        )
        cfnFunction.addDependsOn(props.ds)
        cfnFunction.addDependsOn(props.schema)
        return cfnFunction
    }

    makeRemove(props: {
        schema: appsync.CfnGraphQLSchema
        ds: appsync.CfnDataSource
        apiId: string
        name: string
    }) {
        const cfnFunction = new appsync.CfnFunctionConfiguration(
            this,
            `Function${props.name}`,
            {
                apiId: props.apiId,
                name: props.name,
                functionVersion: '2018-05-29',
                dataSourceName: props.ds.name,
                requestMappingTemplate: `{
                  "version": "2017-02-28",
                  "operation": "DeleteItem",
                  "key": {
                    "pk": $util.dynamodb.toDynamoDBJson($context.stash.input.pk),
                    "sk": $util.dynamodb.toDynamoDBJson($context.stash.input.sk)
                  }
                }`,
                responseMappingTemplate: `
                $util.qr($ctx.stash.put("dbresult", $ctx.result))
                $util.toJson($ctx.result)
                `
            }
        )
        cfnFunction.addDependsOn(props.ds)
        cfnFunction.addDependsOn(props.schema)
        return cfnFunction
    }

    makeEventEmit(props: {
        schema: appsync.CfnGraphQLSchema
        ds: appsync.CfnDataSource
        apiId: string
        name: string
        config: {
            eventBus: string
            source: string
            event: string
            detail: Record<string, string>
        }
    }) {
        let detail = `"{`
        Object.keys(props.config.detail).forEach((x, i, array) => {
            let value = props.config.detail[x]

            if (value.startsWith('$')) {
                value = value.replace('$', '$ctx.args.input.')
            }
            if (value.startsWith('#')) {
                value = value.replace('#', '$ctx.stash.dbresult.')
            }

            detail = detail + `\\\"${x}\\\": \\\"${value}\\\"`

            if (i + 1 < array.length) {
                detail = detail + ','
            }
        })
        detail = detail + `}"`

        const cfnFunction = new appsync.CfnFunctionConfiguration(
            this,
            `Function${props.name}`,
            {
                apiId: props.apiId,
                name: props.name,
                functionVersion: '2018-05-29',
                dataSourceName: props.ds.name,
                requestMappingTemplate: `{
                        "version": "2018-05-29",
                        "method": "POST",
                        "resourcePath": "/",
                        "params": {
                        "headers": {
                            "content-type": "application/x-amz-json-1.1",
                            "x-amz-target":"AWSEvents.PutEvents"
                        },
                        "body": {
                            "Entries":[ 
                            {
                                "Source":"source.${props.config.source}",
                                "EventBusName": "${props.config.eventBus}",
                                "Detail": ${detail},
                                "DetailType":"${props.config.event}"
                            }
                            ]
                        }
                        }
                    }`,
                responseMappingTemplate: `
                    #if($ctx.error)
                        $util.error($ctx.error.message, $ctx.error.type)
                    #end
   
                    #if($ctx.result.statusCode == 200)
                        $util.qr($ctx.stash.put("eventresult", $ctx.result.body))
                        ## If response is 200, return the body.
                        {
                            "result": "$util.parseJson($ctx.result.body)"
                        }    
                    #else
                        $utils.appendError($ctx.result.body, $ctx.result.statusCode)
                    #end`
            }
        )
        cfnFunction.addDependsOn(props.ds)
        cfnFunction.addDependsOn(props.schema)
        return cfnFunction
    }
}
