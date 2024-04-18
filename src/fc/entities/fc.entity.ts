import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"
import { CRUD, Prop, required, Route, expect, Action } from "../backend"
import { fcMetadataKey } from "../meta.helper"
const util = require('util')


@CRUD({})
@Action('/create', {
  method: 'POST',
}, 'create')
@Entity()
export class User {
  @Prop({ type: 'number' })
  @PrimaryGeneratedColumn()
  id: number

  @Prop({ type: 'string' })
  @Column()
  name: string

  @Route('/login', {
    method: 'POST',
    preRoute(o) {
      console.log('preRoute', o, this.req.body)
    },
  })
  login(
    @required
    @expect((s) => s.length > 5)
    username: string,
    @required
    password: string,
  ) {
    console.log('login', username, password)
  }
}


console.log(
  util.inspect(Reflect.getOwnMetadata(fcMetadataKey, User), {
    showHidden: true,
    depth: null,
    colors: true,
  }),
)
