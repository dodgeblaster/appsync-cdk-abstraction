import * as cdk from '@aws-cdk/core'
import * as appsync from '@aws-cdk/aws-appsync'

type QueryConfig = {
    pk?: string
    sk: string
    pk2?: string
    pk3?: string
}

export class RiseResolver extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string) {
        super(scope, id)
    }

    makeQuery(props: {
        schema: appsync.CfnGraphQLSchema
        ds: appsync.CfnDataSource
        apiId: string
        field: string
        config: QueryConfig
    }) {
        let pk = props.config.pk || ''
        if (props.config.pk?.startsWith('$')) {
            pk = pk.replace('$', '$ctx.args.')
        } else {
            pk = `"${pk}"`
        }

        let sk = props.config.sk
        const getOneResolver = new appsync.CfnResolver(
            this,
            `QueryResolver${props.field}`,
            {
                apiId: props.apiId,
                typeName: 'Query',
                fieldName: props.field,
                dataSourceName: props.ds.name,
                requestMappingTemplate: `{
                  "version": "2017-02-28",
                  "operation" : "Query",
                    "query" : {
                        "expression" : "PK = :PK AND begins_with(SK, :SK)",
                        "expressionValues" : {
                            ":PK" : $util.dynamodb.toDynamoDBJson(${pk}),
                            ":SK" : $util.dynamodb.toDynamoDBJson("${sk}")
                        }
                    }
                }`,
                responseMappingTemplate: `$util.toJson($ctx.result.items)`
            }
        )
        getOneResolver.addDependsOn(props.ds)
        getOneResolver.addDependsOn(props.schema)
    }

    makeCreate(props: {
        schema: appsync.CfnGraphQLSchema
        ds: appsync.CfnDataSource
        apiId: string
        field: string
    }) {
        const saveResolver = new appsync.CfnResolver(
            this,
            `MutationResolver${props.field}`,
            {
                apiId: props.apiId,
                typeName: 'Mutation',
                fieldName: props.field,
                dataSourceName: props.ds.name,
                requestMappingTemplate: `{
                  "version": "2017-02-28",
                  "operation": "PutItem",
                  "key": {
                    "PK": $util.dynamodb.toDynamoDBJson($ctx.args.input.PK),
                    "SK": $util.dynamodb.toDynamoDBJson($ctx.args.input.SK)
                  },
                  "attributeValues": $util.dynamodb.toMapValuesJson($ctx.args.input)
                }`,
                responseMappingTemplate: `$util.toJson($ctx.result)`
            }
        )
        saveResolver.addDependsOn(props.ds)
        saveResolver.addDependsOn(props.schema)
    }

    makeRemove(props: {
        schema: appsync.CfnGraphQLSchema
        ds: appsync.CfnDataSource
        apiId: string
        field: string
    }) {
        const saveResolver = new appsync.CfnResolver(
            this,
            `MutationResolver${props.field}`,
            {
                apiId: props.apiId,
                typeName: 'Mutation',
                fieldName: props.field,
                dataSourceName: props.ds.name,
                requestMappingTemplate: `{
                  "version": "2017-02-28",
                  "operation": "DeleteItem",
                  "key": {
                    "PK": $util.dynamodb.toDynamoDBJson($ctx.args.PK),
                    "SK": $util.dynamodb.toDynamoDBJson($ctx.args.SK)
                  }
                }`,
                responseMappingTemplate: `$util.toJson($ctx.result)`
            }
        )
        saveResolver.addDependsOn(props.ds)
        saveResolver.addDependsOn(props.schema)
    }
}
