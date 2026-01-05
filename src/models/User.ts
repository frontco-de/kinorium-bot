import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'

@modelOptions({ schemaOptions: { timestamps: true } })
export class User {
  @prop({ required: true, index: true, unique: true })
  id!: number
  @prop({ required: true, default: 'en' })
  language!: string
}

const UserModel = getModelForClass(User)

export function findOrCreateUser(id: number, defaultLanguage?: string) {
  return UserModel.findOneAndUpdate(
    { id },
    {
      $setOnInsert: {
        id,
        ...(defaultLanguage ? { language: defaultLanguage } : {}),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    }
  ).exec()
}
