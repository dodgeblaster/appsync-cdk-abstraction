import * as cdk from '@aws-cdk/core'
import { RiseApp } from './rise/logic/index'

const definition = {
    schema: `
        type Note {
            pk: String
            sk: String
            name: String
        }

        input NoteInput {
            pk: String
            sk: String
            name: String 
        }
        
        type Query {
            notes: [Note]
        }

        input TestingInput {
            id: String
        }

        type Mutation {
            testing(input: TestingInput): String
            createNote(input: NoteInput): Note
            removeNote(pk: String, sk: String): Note
        }
    `,
    resolvers: {
        Query: {
            notes: {
                type: 'db',
                action: 'list',
                pk: 'notes',
                sk: 'note_'
            }
        },
        Mutation: {
            testing: [
                {
                    type: 'add',
                    sk: 'note_@id',
                    other: 'value'
                }
            ],
            createNote: [
                {
                    type: 'add',
                    sk: 'note_@id',
                    other: 'value'
                },
                {
                    type: 'db',
                    action: 'create'
                },
                {
                    type: 'emit',
                    event: 'note-created',
                    data: {
                        blue: 'orange',
                        sk: '#sk',
                        pk: '$pk'
                    }
                }
            ],
            removeNote: {
                type: 'db',
                action: 'remove'
            }
        }
    },
    config: {
        name: 'rise-cdk-app',
        eventbus: 'rise-cdk-bus',
        region: 'us-east-1'
    }
}

class AppsyncCdkStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string) {
        super(scope, id)
        new RiseApp(this, 'app', { definition })
    }
}
const app = new cdk.App()
new AppsyncCdkStack(app, 'RiseCdkStack')
